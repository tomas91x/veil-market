import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSwap = await deploy("FZamaSwap", {
    from: deployer,
    log: true,
  });

  console.log(`FZamaSwap contract: `, deployedSwap.address);

  const deployedFHECounter = await deploy("FHECounter", {
    from: deployer,
    log: true,
  });

  console.log(`FHECounter contract: `, deployedFHECounter.address);
};
export default func;
func.id = "deploy_fzama_swap"; // id required to prevent reexecution
func.tags = ["FZamaSwap", "FHECounter"];
