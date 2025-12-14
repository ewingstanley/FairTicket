import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * FairTicket合约完整部署模块（包含示例项目创建）
 *
 * 部署方式:
 * npx hardhat ignition deploy ignition/modules/FairTicketWithSetup.ts --network localhost
 * npx hardhat ignition deploy ignition/modules/FairTicketWithSetup.ts --network sepolia --parameters ignition/parameters.json
 *
 * 参数文件示例 (ignition/parameters.json):
 * {
 *   "FairTicketWithSetupModule": {
 *     "initialGlobalId": "1",
 *     "createSampleProject": true,
 *     "sampleFingerprint": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
 *     "sampleOwner": "0xYourProjectOwnerAddress",
 *     "sampleTotalSupply": "100"
 *   }
 * }
 */
export default buildModule("FairTicketWithSetupModule", (m) => {
  // 获取部署参数
  const initialGlobalId = m.getParameter("initialGlobalId", 1n);
  const createSampleProject = m.getParameter("createSampleProject", false);
  const sampleFingerprint = m.getParameter(
    "sampleFingerprint",
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
  const sampleOwner = m.getParameter("sampleOwner", m.getAccount(0));
  const sampleTotalSupply = m.getParameter("sampleTotalSupply", 100n);

  // 部署FairTicket合约
  const fairTicket = m.contract("FairTicket", [initialGlobalId]);

  // 如果需要，创建示例项目
  if (createSampleProject) {
    m.call(fairTicket, "createProject", [
      sampleFingerprint,
      sampleOwner,
      sampleTotalSupply,
    ]);
  }

  return { fairTicket };
});
