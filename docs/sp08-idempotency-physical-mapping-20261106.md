# SP08 幂等物理持久化候选

## 已确认的候选

用户于 2026-11-06 选择“确定性文档 ID + `add`”，并确认版本化 SHA-256 编码。共享层已实现 ID 输入编码、文档 ID 格式函数，以及供载荷摘要候选使用的纯 JSON 稳定序列化工具；SP08 本地 Node 适配器已在 Node 20.19.3 下通过摘要已知向量和共享 ID 集成测试。Node 20.19.3 属于工作区锁定的 Node 20.19.x 运行时范围；CloudBase SDK/托管运行时接受性、并发和恢复仍未验证。本次只改仓库代码、测试和本地记录，没有调用或修改云资源，也没有新增依赖。

候选范围应由可信服务端上下文、允许的业务操作和 `operationKey` 构成。客户端不能决定 actor/owner 或绕过操作白名单。记录需要绑定按具体操作规范化后的载荷摘要和原始命令结果；幂等占位、业务写入及结果应在同一事务边界，满足后端架构合同。这里记录约束，不代表具体业务操作的载荷规范化和事务已经实现。

### 已确认的本地 ID 编码

- 文档 ID 格式为 `idem_v1_<64位小写十六进制 SHA-256>`，总长 72 个 ASCII 字符。版本前缀为 `idem_v1_`。
- 哈希输入是 UTF-8 编码的 JSON 数组：`["o2o.idempotency", 1, trustedScope, operation, operationKey]`。数组位置固定，JSON 字符串转义避免分隔符拼接歧义。
- `trustedScope` 必须由服务端根据具体操作构造，包含可信 actor/ownership 边界；`operation` 必须来自服务端 allowlist。当前共享 helper 不推断字段组成、不认证这些值。
- `operationKey` 使用已通过命令解析的原始字符串，保留首尾空格；全空白仍拒绝，与当前 `parseCommandEnvelope` 行为一致。不同空格形式是不同键。
- 载荷不进入 ID。相同范围、操作和键的不同载荷必须落到同一幂等记录，再由逐操作载荷摘要/等价规则拒绝，而不能绕过冲突生成新记录。
- SHA-256 由调用方注入；共享代码不导入 Node、微信或云数据库 API。服务端适配器必须以 UTF-8 对上述序列化文本执行 SHA-256，并返回 64 位小写十六进制摘要。适配器错误继续作为基础设施错误上抛。
- 文档 ID 不是授权凭据或秘密。服务端必须自行构造可信范围，绝不接受客户端提交的 ID 作为所有权证明；不要把秘密或个人信息放入范围/键。普通 SHA-256 对低熵输入不提供保密性。
- 本地 `node:test` 已在 Node 20.19.3 下用 Node 内置 `node:crypto` 核对 ASCII/非 ASCII UTF-8 摘要向量，并把该适配器接入共享 helper 核对已选 ID 已知向量；共享合同测试另覆盖重复输入稳定性、空白键语义和分隔符歧义。适配器位于 `apps/cloud-functions/src/adapters/sha256-utf8.ts`，没有第三方依赖、环境变量、CloudBase SDK 或可部署入口。Node 20.19.2 官方 [Crypto API 文档](https://r2.nodejs.org/docs/v20.19.2/api/crypto.html)说明 `Hash.update` 支持显式输入编码、`Hash.digest('hex')` 返回十六进制字符串。该结果只证明本机 Node 20.19.3 适配器行为，不证明 CloudBase 托管运行时或指定 SDK 的集成。
- 此本地证明不覆盖 CloudBase 接受该 `_id` 的具体长度/字符约束、指定 SDK 版本的部署执行、并发唯一性或事务原子性。

### 通用 JSON 编码工具与 F09 完整命令摘要（本地纯合同）

- 新增 [`canonical-json.ts`](../packages/shared/src/contracts/canonical-json.ts)：对已经过具体操作验证和规范化的数据，按对象键的 JavaScript UTF-16 码元顺序递归序列化，保留数组顺序。支持 JSON 的字符串、布尔值、null 和有限数值；`-0` 按 JSON 数字语义编码为 `0`。
- 不静默删字段或改值：拒绝 `undefined`、函数、symbol、bigint、非有限数、循环引用、访问器属性、稀疏/额外属性数组、带 symbol 键的对象、非普通对象。通过属性描述符读取，不执行 getter；底层只用 JavaScript 内置能力，没有新增运行时依赖，也不导入平台 API。
- 复用调查：仓库内没有可复用的稳定 JSON 编码器。锁文件中的 `fast-json-stable-stringify@2.1.0` 是 Ajv 的传递依赖而非 `@xianglin/shared` 直接依赖；精确检查本地包源码和类型发现它会读取 `toJSON`/getter、将非有限数转成 `null`、忽略不能序列化的对象字段，且类型声明含 `any`。这些行为不符合严格输入失败策略和无 `any` 规则；维护状态不作为本次采用依据，也没有将其引入产品依赖。原生 `JSON.stringify` 本身不排序对象键；局部实现仅补稳定编码与拒绝策略，改造面更小且可直接在共享层严格检查。
- 专项测试在 `tests/sp08-canonical-json.test.cjs` 覆盖键排序、数组顺序、空字符串/标量、非法值、非有限数、getter 不执行、稀疏和额外数组属性、循环、普通对象边界及检查异常。
- 新增 [`private-address-book-draft-digest.ts`](../packages/shared/src/contracts/private-address-book-draft-digest.ts) 作为局部构件：先复用 F09 现有解析器执行字段白名单、修剪和校验，再对版本化域 `o2o.f09.private-address-book-entry-draft`、版本 `1` 和规范化后的五字段对象执行规范 JSON 序列化，并调用注入的 SHA-256 UTF-8 适配器。返回值只含摘要或通用失败原因，不返回地址内容；共享层未增加 Node、微信或 CloudBase 依赖。
- 专项测试在 `tests/sp08-data-request-contract.test.cjs` 验证字段顺序/边缘空白/缺省备注归一后摘要一致、五个字段任一变化会改变摘要、无效草稿不会调用哈希适配器、畸形摘要输出被拒绝，以及返回值不包含地址字段。通过 `npm run check:shared` 验证 strict TypeScript。
- 新增 [`private-address-book-command-digest.ts`](../packages/shared/src/contracts/private-address-book-command-digest.ts)：复用 F09 草稿解析器和稳定 JSON 序列化器，为 `create`、`update`、`delete` 定义本地命令规范化。`create` 包含规范化五字段草稿与 `makeDefault`；`update` 另包含精确保留的 `addressId` 和有限数值 `expectedVersion`；`delete` 包含 `addressId` 与有限数值 `expectedVersion`。`create` 禁止携带版本，更新/删除要求版本字段。域为 `o2o.f09.private-address-book-command`、版本 `1`；SHA-256 仍由调用方注入。返回不包含地址字段。
- V09 默认地址保存切换由 [`private-address-book.ts`](../packages/shared/src/contracts/private-address-book.ts) 的纯函数表达：开启设默认会替换旧指针；关闭时仅当当前记录正是默认地址才清空指针；删除当前默认地址清空指针且不自动提升其它地址。这些规则仍须在服务器验证归属并与地址写入原子提交。
- 命令合同测试在 `tests/sp08-data-request-contract.test.cjs` 覆盖 create/update/delete 字段与版本边界、地址草稿空白/缺省字段归一、目标 ID/默认意图/期望版本对摘要的影响、无效输入不调用哈希、摘要格式，以及默认指针转换。验证只证明共享纯函数。
- 复用判断：项目内已有 F09 规范化解析器、稳定 JSON 序列化器和默认指针类型；直接组合比引入 schema/hash 依赖改造更小。没有新增第三方依赖，SHA-256 沿用注入边界。此项已经实现完整的 F09 本地命令载荷摘要构件（create/update/delete），但不等于已将摘要连接到幂等重放/拒绝，也不等于权限、服务器版本比较、物理写入或事务验收。
- 地址摘要不是匿名化或保密机制，不能单独替代访问控制；不要将个人地址、摘要或相关请求体写入普通日志。

## 复用调查与平台证据

- 项目内复用：`packages/shared/src/contracts/idempotency.ts` 已定义在服务端比较过载荷后“重放原结果或拒绝不匹配载荷”的纯决策；它没有实现查询、持久化、事务占位或未知结果恢复。
- 项目能力映射：[`sp08-database-capability-map-20261105.md`](sp08-database-capability-map-20261105.md) 记录 CloudBase 文档型数据库的事务限制、唯一索引语义及 SP01 合成事务实测边界。
- 官方 API：[CloudBase Node SDK 数据库文档](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/database/database.md)示例显示 `add` 可提交显式 `_id`；文档位于 master，未钉定仓库临时探针使用的 `@cloudbase/node-sdk@3.18.7`，只证明 API 形状，不证明并发唯一行为适用于本方案。
- 补充 API：[数据库 add 参考](https://docs.cloudbase.net/api-reference/webv3-pg/database)说明 `add` 接受文档数据并可使用指定 ID；它不是 Node SDK 指定 ID + add 的版本级运行时证明。
- 官方错误参考：[数据库错误码](https://docs.cloudbase.net/error-code/basic)将重复索引键列为 `DATABASE_DUPLICATE_WRITE` 的情形，其中包括重复文档 ID；生产函数中如何识别和恢复仍需实测。
- 官方事务参考：[文档型数据库事务](https://docs.cloudbase.net/database/transaction)说明事务由服务端 Node SDK 执行，事务方法包括 `add`，单个事务最长 10 秒。该平台说明不证明本业务事务的竞争、提交或故障恢复正确。
- 不新增第三方库：现有 CloudBase SDK/API 足以表达候选写入；目前缺少业务代码和并发证据，故不引入锁库或重试库。

### 指定 SDK `add` 回执防护

- 复用核查针对候选 SDK 的精确 npm tarball：[`@cloudbase/node-sdk@3.18.7`](https://registry.npmjs.org/@cloudbase/node-sdk/-/node-sdk-3.18.7.tgz) 的包元数据标注 MIT、Node `>=12`，并精确依赖 `@cloudbase/database@1.4.3`；[`@cloudbase/database@1.4.3`](https://registry.npmjs.org/@cloudbase/database/-/database-1.4.3.tgz) 标注 ISC。两个 tarball 的 SHA-256 与可复查信息记录在配套 JSON 的 `cloudBaseSdkAudit`。
- 读取 1.4.3 的 `src/collection.ts` 后确认：`add` 遇到带 truthy `code` 的服务端响应时直接返回该对象；成功的单文档事务写入返回 `inserted: 1`、`ok: 1`、`id` 和 `requestId`。包内 `src/transaction/index.ts` 显示 `runTransaction` 会等待回调成功，再尝试 `commit`。这是对本地精确 tarball 源码的观察，不是 CloudBase 目标环境的运行结果。
- 因此新增无 SDK 依赖的纯形状适配器 [`cloudbase-add-result.ts`](../apps/cloud-functions/src/adapters/cloudbase-add-result.ts)：在单条写入需要的确认中拒绝 truthy `code`、缺失/空 `id`、畸形 `requestId`；事务模式还要求 `inserted === 1 && ok === 1`。遇到不确认的响应时只抛通用基础设施错误，不把 SDK 原始错误对象或消息交给调用方。事务回调必须在回执校验失败时抛出，不能把错误对象当成成功结果返回。
- 复用选择：直接用 CloudBase 的 `add` 与事务 API表达候选，不加锁库；以少量纯适配封装 SDK 已有回执形状。适配器尚未接入正式事务处理函数；CloudBase 产品依赖仍按 SP07 工程门槛处理，没有安装或新增 SDK 依赖。
- 本地专项验证覆盖错误对象、正常单条回执（有/无请求 ID）、事务成功标志、畸形/批量响应以及适配器不依赖 SDK/平台。测试不能证明实际 CloudBase 事务回滚、并发胜出、唯一性、提交结果或未知结果恢复；没有证明目标 CloudBase 运行时的实际表现，本轮也未执行目标运行时测试。
- 复用核查来源还包括 CloudBase [事务官方文档](https://docs.cloudbase.net/database/transaction)（平台事务范围/时限）和 [Node SDK 数据库文档](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/database/database.md)（通用 API 形状）。后者是未钉版本的 master 文档，因此精确回执观察以已记录哈希的 1.4.3 tarball 源码为准。

## 仍未确定或未验证

- **服务端摘要比较与其它业务操作规范化**：F09 的 create/update/delete 命令字段、默认意图和版本字段已有本地规范化摘要；尚未接入服务端载荷摘要比较、同键原结果重放或不同载荷拒绝。F09 的 expectedVersion 仅作有限数值形状校验，服务端与当前记录比较仍未实现。其它业务操作的载荷字段与等价规则继续由各自 SP 卡确定。以上不能单独作为端到端幂等证明。
- **CloudBase 运行时实测**：本地适配器已在 Node 20.19.3 下通过测试；仍需按 CloudBase 实际函数包和 SDK 环境证明指定 ID 格式及 `add` 的接受性。该事项属于后续物理映射与运行时验收，不由本地适配器测试替代。
- **集合和保留期限**：待实际对象映射、数据生命周期及查询/恢复合同确定；本记录不创建集合。
- **原子性和并发**：必须证明并发 `add` 对相同确定性 ID 产生一个有效所有者，并把幂等记录与业务写入放在同一可恢复事务中。不能用“先查再写”消除竞争；也不把 `set` 当作独占领取，因为官方定义是缺失时新建、存在时覆盖。
- **未知结果恢复**：响应丢失后按同一可信范围和请求键查询并返回原结果，或明确报告可恢复状态；不得创建新键重新执行副作用。

需要的运行时验证至少包括：同 ID 并发 add 的单一胜者；相同载荷重放原始结果；不同载荷复用键被拒绝；丢失响应后同键查询恢复。数据库错误对象、事务重试及部分失败的清理也要记录请求输入、预期、实际和原始证据。当前这些均为 `not-proven`，不在本轮执行云端测试。

## 归属与后续

候选记录归 SP08 的真实数据库与幂等合同工作。具体模块的输入规则和端到端流程仍由各自 SP 卡负责；模块验收须使用相同原始门槛。此候选不会将 SP08 标为完成，也不会为后续模块免除权限、并发、重复请求、版本冲突、弱网、未知结果和恢复验收。
