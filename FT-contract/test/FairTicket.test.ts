import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { keccak256, encodePacked, getAddress } from "viem";

describe("FairTicket", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, projectOwner, user1, user2, user3, user4] =
    await viem.getWalletClients();

  describe("部署和初始化", async function () {
    it("应该正确设置初始globalId", async function () {
      const initialGlobalId = 1n;
      const fairTicket = await viem.deployContract("FairTicket", [
        initialGlobalId,
      ]);

      const globalId = await fairTicket.read.s_globalId();
      assert.equal(globalId, initialGlobalId);
    });

    it("应该正确设置合约owner", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const contractOwner = await fairTicket.read.owner();
      assert.equal(contractOwner, getAddress(owner.account.address));
    });
  });

  describe("createProject", async function () {
    it("应该成功创建项目并触发事件", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test-project"]));
      const totalSupply = 100n;

      await viem.assertions.emitWithArgs(
        fairTicket.write.createProject([
          fingerprint,
          projectOwner.account.address,
          totalSupply,
        ]),
        fairTicket,
        "ProjectCreated",
        [1n, fingerprint]
      );

      const project = await fairTicket.read.getProjectInfo([1n]);
      assert.equal(project.id, 1n);
      assert.equal(project.fingerprint, fingerprint);
      assert.equal(project.owner, getAddress(projectOwner.account.address));
      assert.equal(project.totalSupply, totalSupply);
      assert.equal(project.projectStatus, 0);

      const newGlobalId = await fairTicket.read.s_globalId();
      assert.equal(newGlobalId, 2n);
    });

    it("应该拒绝非owner创建项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));

      await assert.rejects(
        async () => {
          await fairTicket.write.createProject(
            [fingerprint, projectOwner.account.address, 100n],
            { account: user1.account }
          );
        },
        (error: Error) => {
          return error.message.includes("OwnableUnauthorizedAccount");
        }
      );
    });

    it("应该拒绝totalSupply为0", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));

      await assert.rejects(
        async () => {
          await fairTicket.write.createProject([
            fingerprint,
            projectOwner.account.address,
            0n,
          ]);
        },
        (error: Error) => {
          return error.message.includes("TotalSupplyZero");
        }
      );
    });

    it("应该能创建多个项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fp1 = keccak256(encodePacked(["string"], ["project-1"]));
      const fp2 = keccak256(encodePacked(["string"], ["project-2"]));

      await fairTicket.write.createProject([
        fp1,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.createProject([
        fp2,
        projectOwner.account.address,
        200n,
      ]);

      assert.equal(await fairTicket.read.s_globalId(), 3n);
    });
  });

  describe("startProject", async function () {
    it("应该成功启动项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      await viem.assertions.emitWithArgs(
        fairTicket.write.startProject([1n]),
        fairTicket,
        "ProjectStarted",
        [1n]
      );

      const status = await fairTicket.read.getProjectStatus([1n]);
      assert.equal(status, 1); // InProgress
    });

    it("应该拒绝非owner启动项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      await assert.rejects(
        async () => {
          await fairTicket.write.startProject([1n], { account: user1.account });
        },
        (error: Error) => {
          return error.message.includes("OwnableUnauthorizedAccount");
        }
      );
    });

    it("应该拒绝启动不存在的项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.startProject([999n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotFound");
        }
      );
    });

    it("应该拒绝重复启动", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.startProject([1n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectAlreadyStarted");
        }
      );
    });
  });

  describe("participate", async function () {
    it("应该成功参与项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      const luckyNum = 42n;
      await fairTicket.write.participate([
        1n,
        user1.account.address,
        luckyNum,
      ]);

      const participant = await fairTicket.read.getParticipantInfo([
        1n,
        user1.account.address,
      ]);
      assert.equal(participant.addr, getAddress(user1.account.address));
      assert.equal(participant.luckyNum, luckyNum);

      const count = await fairTicket.read.getProjectParticipantsAmount([1n]);
      assert.equal(count, 1n);
    });

    it("应该拒绝参与不存在的项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.participate([999n, user1.account.address, 42n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotFound");
        }
      );
    });

    it("应该拒绝参与未启动的项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      await assert.rejects(
        async () => {
          await fairTicket.write.participate([1n, user1.account.address, 42n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotInProgress");
        }
      );
    });

    it("应该拒绝参与已结束的项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.finishProject([1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.participate([1n, user1.account.address, 42n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotInProgress");
        }
      );
    });

    it("应该允许多个用户参与", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);
      await fairTicket.write.participate([1n, user2.account.address, 20n]);
      await fairTicket.write.participate([1n, user3.account.address, 30n]);

      const count = await fairTicket.read.getProjectParticipantsAmount([1n]);
      assert.equal(count, 3n);
    });
  });

  describe("finishProject", async function () {
    it("应该成功结束项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await viem.assertions.emitWithArgs(
        fairTicket.write.finishProject([1n]),
        fairTicket,
        "ProjectFinished",
        [1n]
      );

      const status = await fairTicket.read.getProjectStatus([1n]);
      assert.equal(status, 2); // Finished
    });

    it("应该拒绝非owner结束项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.finishProject([1n], {
            account: user1.account,
          });
        },
        (error: Error) => {
          return error.message.includes("OwnableUnauthorizedAccount");
        }
      );
    });

    it("应该拒绝结束不存在的项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.finishProject([999n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotFound");
        }
      );
    });

    it("应该拒绝结束未启动的项目", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      await assert.rejects(
        async () => {
          await fairTicket.write.finishProject([1n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotInProgress");
        }
      );
    });
  });

  describe("lottery", async function () {
    it("应该成功进行抽奖", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.finishProject([1n]);

      await viem.assertions.emitWithArgs(
        fairTicket.write.lottery([1n]),
        fairTicket,
        "MagicNumberPublished",
        [1n, 1234567890n]
      );

      const result = await fairTicket.read.getLotteryResult([1n]);
      assert.equal(result.projectId, 1n);
      assert.equal(result.magicNumber, 1234567890n);

      const magicNumber = await fairTicket.read.getMagicNumber([1n]);
      assert.equal(magicNumber, 1234567890n);
    });

    it("应该拒绝非owner进行抽奖", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.finishProject([1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.lottery([1n], { account: user1.account });
        },
        (error: Error) => {
          return error.message.includes("OwnableUnauthorizedAccount");
        }
      );
    });

    it("应该拒绝对不存在的项目抽奖", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.lottery([999n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotFound");
        }
      );
    });

    it("应该拒绝对未结束的项目抽奖", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await assert.rejects(
        async () => {
          await fairTicket.write.lottery([1n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotFinished");
        }
      );
    });

    it("应该拒绝对NotStart状态的项目抽奖", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      await assert.rejects(
        async () => {
          await fairTicket.write.lottery([1n]);
        },
        (error: Error) => {
          return error.message.includes("ProjectNotFinished");
        }
      );
    });
  });

  describe("SetMerkleRoot", async function () {
    it("应该成功设置MerkleRoot", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const merkleRoot = keccak256(encodePacked(["string"], ["test-root"]));
      await fairTicket.write.SetMerkleRoot([1n, merkleRoot]);

      const project = await fairTicket.read.getProjectInfo([1n]);
      assert.equal(project.merkleRoot, merkleRoot);
    });

    it("应该拒绝非owner设置MerkleRoot", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const merkleRoot = keccak256(encodePacked(["string"], ["test-root"]));
      await assert.rejects(
        async () => {
          await fairTicket.write.SetMerkleRoot([1n, merkleRoot], {
            account: user1.account,
          });
        },
        (error: Error) => {
          return error.message.includes("OwnableUnauthorizedAccount");
        }
      );
    });

    it("应该拒绝重复设置MerkleRoot", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const merkleRoot = keccak256(encodePacked(["string"], ["test-root"]));
      await fairTicket.write.SetMerkleRoot([1n, merkleRoot]);

      await assert.rejects(
        async () => {
          await fairTicket.write.SetMerkleRoot([1n, merkleRoot]);
        },
        (error: Error) => {
          return error.message.includes("MerkleRootAlreadySet");
        }
      );
    });
  });

  describe("verifyMerkleProof", async function () {
    it("应该验证merkleRoot已设置", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const merkleRoot = keccak256(encodePacked(["string"], ["test-root"]));
      await fairTicket.write.SetMerkleRoot([1n, merkleRoot]);

      const project = await fairTicket.read.getProjectInfo([1n]);
      assert.equal(project.merkleRoot, merkleRoot);
    });

    it("应该拒绝无效的MerkleProof并抛出错误", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const merkleRoot = keccak256(encodePacked(["string"], ["test-root"]));
      await fairTicket.write.SetMerkleRoot([1n, merkleRoot]);

      const invalidProof: `0x${string}`[] = [];

      await assert.rejects(
        async () => {
          await fairTicket.read.verifyMerkleProof([1n, invalidProof], {
            account: user1.account,
          });
        },
        (error: Error) => {
          return error.message.includes("MerkleProofInvalid");
        }
      );
    });

    it("应该测试verifyMerkleProof的调用路径", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const merkleRoot = keccak256(encodePacked(["string"], ["any-root"]));
      await fairTicket.write.SetMerkleRoot([1n, merkleRoot]);

      await assert.rejects(
        async () => {
          await fairTicket.read.verifyMerkleProof([1n, []], {
            account: user2.account,
          });
        },
        (error: Error) => {
          return error.message.includes("MerkleProofInvalid");
        }
      );
    });
  });

  describe("getProjectParticipants 分页功能", async function () {
    it("应该正确返回分页的参与者", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);
      await fairTicket.write.participate([1n, user2.account.address, 20n]);
      await fairTicket.write.participate([1n, user3.account.address, 30n]);

      const page1 = await fairTicket.read.getProjectParticipants([1n, 0n, 2n]);
      assert.equal(page1.length, 2);
      assert.equal(page1[0].addr, getAddress(user1.account.address));
      assert.equal(page1[0].luckyNum, 10n);
      assert.equal(page1[1].addr, getAddress(user2.account.address));
      assert.equal(page1[1].luckyNum, 20n);

      const page2 = await fairTicket.read.getProjectParticipants([1n, 2n, 2n]);
      assert.equal(page2.length, 1);
      assert.equal(page2[0].addr, getAddress(user3.account.address));
      assert.equal(page2[0].luckyNum, 30n);
    });

    it("应该在offset超出范围时revert", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);

      await assert.rejects(
        async () => {
          await fairTicket.read.getProjectParticipants([1n, 10n, 5n]);
        },
        (error: Error) => {
          return error.message.includes("OffsetOutOfBounds");
        }
      );
    });

    it("应该在limit超出实际数量时自动调整", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);
      await fairTicket.write.participate([1n, user2.account.address, 20n]);

      const result = await fairTicket.read.getProjectParticipants([
        1n,
        0n,
        10n,
      ]);
      assert.equal(result.length, 2);
    });

    it("应该处理offset在边界的情况", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);

      await assert.rejects(
        async () => {
          await fairTicket.read.getProjectParticipants([1n, 1n, 1n]);
        },
        (error: Error) => {
          return error.message.includes("OffsetOutOfBounds");
        }
      );
    });

    it("应该测试offset+limit边界情况", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);
      await fairTicket.write.participate([1n, user2.account.address, 20n]);
      await fairTicket.write.participate([1n, user3.account.address, 30n]);

      const result = await fairTicket.read.getProjectParticipants([1n, 1n, 5n]);
      assert.equal(result.length, 2);
    });
  });

  describe("Getter函数完整测试", async function () {
    it("getProjectInfo应该返回完整项目信息", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      const totalSupply = 100n;
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        totalSupply,
      ]);

      const project = await fairTicket.read.getProjectInfo([1n]);
      assert.equal(project.id, 1n);
      assert.equal(project.fingerprint, fingerprint);
      assert.equal(project.owner, getAddress(projectOwner.account.address));
      assert.equal(project.totalSupply, totalSupply);
      assert.equal(project.projectStatus, 0);
      assert.equal(
        project.merkleRoot,
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("getProjectStatus应该返回所有状态", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      assert.equal(await fairTicket.read.getProjectStatus([1n]), 0);

      await fairTicket.write.startProject([1n]);
      assert.equal(await fairTicket.read.getProjectStatus([1n]), 1);

      await fairTicket.write.finishProject([1n]);
      assert.equal(await fairTicket.read.getProjectStatus([1n]), 2);
    });

    it("getParticipantInfo应该返回参与者信息", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      const luckyNum = 777n;
      await fairTicket.write.participate([1n, user1.account.address, luckyNum]);

      const participant = await fairTicket.read.getParticipantInfo([
        1n,
        user1.account.address,
      ]);
      assert.equal(participant.addr, getAddress(user1.account.address));
      assert.equal(participant.luckyNum, luckyNum);
    });

    it("getProjectParticipantsAmount应该返回正确数量", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);

      assert.equal(await fairTicket.read.getProjectParticipantsAmount([1n]), 0n);

      await fairTicket.write.participate([1n, user1.account.address, 10n]);
      assert.equal(await fairTicket.read.getProjectParticipantsAmount([1n]), 1n);

      await fairTicket.write.participate([1n, user2.account.address, 20n]);
      assert.equal(await fairTicket.read.getProjectParticipantsAmount([1n]), 2n);
    });

    it("getLotteryResult应该返回抽奖结果", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.finishProject([1n]);
      await fairTicket.write.lottery([1n]);

      const result = await fairTicket.read.getLotteryResult([1n]);
      assert.equal(result.projectId, 1n);
      assert.equal(result.magicNumber, 1234567890n);
    });
  });

  describe("mapping读取测试", async function () {
    it("应该正确读取s_pid2project映射", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);

      const project = await fairTicket.read.s_pid2project([1n]);
      assert.equal(project[0], 1n); // id as tuple element
      assert.equal(project[1], fingerprint); // fingerprint as tuple element
    });

    it("应该正确读取s_projectid_paddr_participant映射", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.participate([1n, user1.account.address, 99n]);

      const participant =
        await fairTicket.read.s_projectid_paddr_participant([
          1n,
          user1.account.address,
        ]);
      assert.equal(participant[0], getAddress(user1.account.address)); // addr as tuple element
      assert.equal(participant[1], 99n); // luckyNum as tuple element
    });

    it("应该正确读取s_projectid_lottery映射", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fingerprint = keccak256(encodePacked(["string"], ["test"]));
      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.finishProject([1n]);
      await fairTicket.write.lottery([1n]);

      const lotteryResult = await fairTicket.read.s_projectid_lottery([1n]);
      assert.equal(lotteryResult[0], 1n); // projectId as tuple element
      assert.equal(lotteryResult[1], 1234567890n); // magicNumber as tuple element
    });
  });

  describe("SimpleMock库测试", async function () {
    it("SimpleMock.simpleVRF应该总是返回固定值", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [1n]);
      const fp1 = keccak256(encodePacked(["string"], ["project-1"]));
      const fp2 = keccak256(encodePacked(["string"], ["project-2"]));

      await fairTicket.write.createProject([
        fp1,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([1n]);
      await fairTicket.write.finishProject([1n]);
      await fairTicket.write.lottery([1n]);

      await fairTicket.write.createProject([
        fp2,
        projectOwner.account.address,
        100n,
      ]);
      await fairTicket.write.startProject([2n]);
      await fairTicket.write.finishProject([2n]);
      await fairTicket.write.lottery([2n]);

      const magic1 = await fairTicket.read.getMagicNumber([1n]);
      const magic2 = await fairTicket.read.getMagicNumber([2n]);

      assert.equal(magic1, 1234567890n);
      assert.equal(magic2, 1234567890n);
    });
  });

  describe("完整项目生命周期测试", async function () {
    it("应该完整走完一个项目的所有流程", async function () {
      const fairTicket = await viem.deployContract("FairTicket", [100n]);
      const fingerprint = keccak256(encodePacked(["string"], ["full-cycle"]));

      await fairTicket.write.createProject([
        fingerprint,
        projectOwner.account.address,
        50n,
      ]);
      assert.equal(await fairTicket.read.getProjectStatus([100n]), 0);

      await fairTicket.write.startProject([100n]);
      assert.equal(await fairTicket.read.getProjectStatus([100n]), 1);

      await fairTicket.write.participate([100n, user1.account.address, 11n]);
      await fairTicket.write.participate([100n, user2.account.address, 22n]);
      await fairTicket.write.participate([100n, user3.account.address, 33n]);
      await fairTicket.write.participate([100n, user4.account.address, 44n]);

      assert.equal(
        await fairTicket.read.getProjectParticipantsAmount([100n]),
        4n
      );

      await fairTicket.write.finishProject([100n]);
      assert.equal(await fairTicket.read.getProjectStatus([100n]), 2);

      await fairTicket.write.lottery([100n]);
      const magicNumber = await fairTicket.read.getMagicNumber([100n]);
      assert.equal(magicNumber, 1234567890n);

      const merkleRoot = keccak256(encodePacked(["string"], ["winners-root"]));
      await fairTicket.write.SetMerkleRoot([100n, merkleRoot]);

      await assert.rejects(
        async () => {
          await fairTicket.read.verifyMerkleProof([100n, []], {
            account: user1.account,
          });
        },
        (error: Error) => {
          return error.message.includes("MerkleProofInvalid");
        }
      );

      const allParticipants = await fairTicket.read.getProjectParticipants([
        100n,
        0n,
        10n,
      ]);
      assert.equal(allParticipants.length, 4);
    });
  });
});
