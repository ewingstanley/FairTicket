import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { hardhat } from "viem/chains";

/**
 * FairTicket合约部署模块
 *
 * 部署方式:
 * npx hardhat ignition deploy ignition/modules/FairTicket.ts --network localhost
 * npx hardhat ignition deploy ignition/modules/FairTicket.ts --network sepolia
 */
export default buildModule("FairTicketModule", (m) => {
  // 设置初始globalId，可以通过参数覆盖
  const initialGlobalId = m.getParameter("initialGlobalId", 1n);

  // 部署FairTicket合约
  const fairTicket = m.contract("FairTicket", [initialGlobalId]);

  return { fairTicket };
});


