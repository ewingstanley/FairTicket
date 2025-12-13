# Hardhat 3 Beta 示例项目 (`node:test` 和 `viem`)

本项目展示了一个使用原生 Node.js 测试运行器 (`node:test`) 和 `viem` 库进行以太坊交互的 Hardhat 3 Beta 项目。

要了解更多关于 Hardhat 3 Beta 的信息，请访问[入门指南](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3)。要分享您的反馈，请加入我们的 [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram 群组，或在我们的 GitHub 问题跟踪器中[提交问题](https://github.com/NomicFoundation/hardhat/issues/new)。

## 项目概述

本示例项目包括：

- 一个简单的 Hardhat 配置文件。
- 兼容 Foundry 的 Solidity 单元测试。
- 使用 [`node:test`](nodejs.org/api/test.html)（新的 Node.js 原生测试运行器）和 [`viem`](https://viem.sh/) 的 TypeScript 集成测试。
- 展示如何连接到不同类型网络的示例，包括在本地模拟 OP 主网。

## 使用说明

### 运行测试

要运行项目中的所有测试，请执行以下命令：

```shell
npx hardhat test
```

您也可以选择性地运行 Solidity 或 `node:test` 测试：

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### 部署到 Sepolia

本项目包含一个示例 Ignition 模块用于部署合约。您可以将此模块部署到本地模拟链或 Sepolia 测试网。

要运行部署到本地链：

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

要运行部署到 Sepolia，您需要一个有资金的账户来发送交易。提供的 Hardhat 配置包含一个名为 `SEPOLIA_PRIVATE_KEY` 的配置变量，您可以使用它来设置要使用的账户的私钥。

您可以使用 `hardhat-keystore` 插件或将其设置为环境变量来设置 `SEPOLIA_PRIVATE_KEY` 变量。

使用 `hardhat-keystore` 设置 `SEPOLIA_PRIVATE_KEY` 配置变量：

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

设置变量后，您可以使用 Sepolia 网络运行部署：

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```
