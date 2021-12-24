const { run, network, ethers } = require("hardhat");
const { expect } = require("chai");

const impersonateAddress = async (address) => {
	await hre.network.provider.request({
	  	method: "hardhat_impersonateAccount",
	  	params: [address],
	});

	const signer = await ethers.provider.getSigner(address);
	signer.address = signer._address;
	return signer;
}

const stopImpersonateAddress = async (address) => {
	await hre.network.provider.request({
	  	method: "hardhat_stopImpersonatingAccount",
	  	params: [address],
	});
}


describe("AaveV2FlashLoan", async () => {
	let aave_contract;
	let owner;
	let daiContract;
	const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
	const weth9 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
	const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
	const uni = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
	const DAI_WHALE = "0xA929022c9107643515F5c777cE9a910F0D1e490C";
	const WETH_WHALE = "0x0F4ee9631f4be0a63756515141281A3E2B293Bbe";

	const provider = ethers.provider;

	const DECIMALS = 18;

	const LOAN_AMOUNT = 10000;
	const ARB_AMOUNT = 1000;


	beforeEach(async () => {
		[owner] = await ethers.getSigners();

		const AaveV2FlashLoan = await ethers.getContractFactory("AaveV2FlashLoan", {
           	libraries: {
              NetworkFeesAndConfigs: process.env.NETWORKFEECONFIGS_CONTRACT_ADDRESS
           	}
       	});

		aave_contract = await AaveV2FlashLoan.deploy(process.env.KYBER_NETWORK_PROXY_MAIN,process.env.SUSHIV2_ROUTER_ADDRESS, process.env.UNISWAPV2_ROUTER_ADDRESS, process.env.AAVE_LENDING_POOL_ADDRESSES_PROVIDER);
	})

	it("Should start off with an empty balance", async function() {
		const contract_balance = await provider.getBalance(aave_contract.address);
		expect(ethers.utils.formatUnits(contract_balance._hex, "ether")).to.equal("0.0");
	})

	describe("Has a balance", async() => {
		beforeEach(async () => {
			// Send ETH
			const params = [{
		        from: owner.address,
		        to: aave_contract.address,
		        value: ethers.utils.parseUnits("10", 'ether').toHexString()
		    }];
		    const transactionHash = await provider.send('eth_sendTransaction', params);
		    // Send DAI
		    const erc20Artifact = await artifacts.readArtifact("IERC20");
			daiContract = await new ethers.Contract(dai, erc20Artifact.abi, provider);
			const signer = await impersonateAddress(DAI_WHALE);

			let beforeBalance = await daiContract.balanceOf(aave_contract.address);
			// console.log("DAI Balance of Aave Contract: ", ethers.utils.formatEther(beforeBalance));

			const daiContractWithSigner = daiContract.connect(signer);
			await daiContractWithSigner.transfer(aave_contract.address, ethers.utils.parseEther(String(LOAN_AMOUNT)));
		})

		it("Should have a balance after owner sends the contract some ETH", async function() {
			const contract_balance = await provider.getBalance(aave_contract.address);
			expect(ethers.utils.formatUnits(contract_balance._hex, "ether")).to.equal("10.0");
		})

		it("Should send Aave Contract some DAI from impersonator", async function() {
			newBalance = await daiContract.balanceOf(aave_contract.address);
			await stopImpersonateAddress(DAI_WHALE);
			// console.log("DAI Balance After: ",ethers.utils.formatUnits(newBalance._hex, "ether"))
			expect(ethers.utils.formatUnits(newBalance._hex, "ether")).to.equal("10000.0");
		})

		it('Should return the address of owner.', async () => {
			expect(await aave_contract.owner()).to.equal(owner.address);
		})

		it("Should execute myFlashLoanCall", async function() {
			const balance = await provider.getBalance(aave_contract.address);

			const tx = await aave_contract.myFlashLoanCall(dai, uni, ethers.utils.parseEther(String(ARB_AMOUNT)), 0, "kyber", "uniswap");
			expect(tx.hash).to.be.not.null;

			expect(await provider.getTransactionReceipt(tx.hash)).to.be.not.null;
		})
	})
})