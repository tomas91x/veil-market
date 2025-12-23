import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Example:
 *   - npx hardhat --network localhost task:swap --amount 0.1
 *   - npx hardhat --network sepolia task:swap --amount 0.1
 */
task("task:swap", "Swaps ETH for fZama at a fixed rate")
  .addOptionalParam("address", "Optionally specify the swap contract address")
  .addParam("amount", "ETH amount to swap")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const amount = taskArguments.amount;
    let value: bigint;
    try {
      value = ethers.parseEther(amount);
    } catch (error) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    if (value <= 0n) {
      throw new Error("Amount must be greater than zero");
    }

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FZamaSwap");

    const [signer] = await ethers.getSigners();
    const swapContract = await ethers.getContractAt("FZamaSwap", deployment.address);

    const tx = await swapContract.connect(signer).swap({ value });
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:decrypt-balance
 *   - npx hardhat --network sepolia task:decrypt-balance --user 0x...
 */
task("task:decrypt-balance", "Decrypts the encrypted fZama balance for a user")
  .addOptionalParam("address", "Optionally specify the swap contract address")
  .addOptionalParam("user", "Optionally specify the user address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("FZamaSwap");

    const [signer] = await ethers.getSigners();
    const user = taskArguments.user || signer.address;

    const swapContract = await ethers.getContractAt("FZamaSwap", deployment.address);
    const encryptedBalance = await swapContract.balanceOf(user);

    if (encryptedBalance === ethers.ZeroHash) {
      console.log(`Encrypted balance: ${encryptedBalance}`);
      console.log("Clear balance    : 0");
      return;
    }

    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      encryptedBalance,
      deployment.address,
      signer,
    );

    console.log(`Encrypted balance: ${encryptedBalance}`);
    console.log(`Clear balance    : ${clearBalance}`);
  });
