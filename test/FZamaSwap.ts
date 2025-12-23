import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { FZamaSwap, FZamaSwap__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FZamaSwap")) as FZamaSwap__factory;
  const swapContract = (await factory.deploy()) as FZamaSwap;
  const swapContractAddress = await swapContract.getAddress();

  return { swapContract, swapContractAddress };
}

describe("FZamaSwap", function () {
  let signers: Signers;
  let swapContract: FZamaSwap;
  let swapContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ swapContract, swapContractAddress } = await deployFixture());
  });

  it("returns zero balance before any swaps", async function () {
    const encryptedBalance = await swapContract.balanceOf(signers.alice.address);
    expect(encryptedBalance).to.eq(ethers.ZeroHash);
  });

  it("swaps ETH into encrypted fZama balance", async function () {
    const ethIn = ethers.parseEther("1");
    const expected = ethIn * 800n;

    const tx = await swapContract.connect(signers.alice).swap({ value: ethIn });
    await tx.wait();

    const encryptedBalance = await swapContract.balanceOf(signers.alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint128,
      encryptedBalance,
      swapContractAddress,
      signers.alice,
    );

    expect(clearBalance).to.eq(expected);
  });

  it("previews swap output", async function () {
    const ethIn = ethers.parseEther("0.25");
    const expected = ethIn * 800n;
    const preview = await swapContract.previewSwap(ethIn);
    expect(preview).to.eq(expected);
  });

  it("reverts on zero ETH", async function () {
    await expect(swapContract.connect(signers.alice).swap({ value: 0 })).to.be.revertedWith("No ETH sent");
  });
});
