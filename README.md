# Temu Edge扩展 GitHub授权仓库

本仓库保存经过数字签名的扩展授权。扩展通过GitHub账号ID和浏览器安装码共同校验授权。

## 第一次设置

1. 在GitHub新建一个公开仓库，建议名称 `temu-extension-license`，默认分支必须是 `main`。
2. 把本目录内的全部文件上传到新仓库，注意不要上传任何 `.pem` 私钥文件。
3. 打开仓库 `Settings > Actions > General`，在 `Workflow permissions` 中选择 `Read and write permissions` 后保存。
4. 打开仓库 `Settings > Secrets and variables > Actions`，新建 Repository secret：
   - Name：`LICENSE_PRIVATE_KEY`
   - Secret：粘贴所有者管理包里的 `OWNER_PRIVATE_KEY.pem` 全部内容，包括BEGIN和END两行。
5. 在GitHub头像菜单中打开 `Settings > Developer settings > OAuth Apps > New OAuth App`：
   - Application name：`Temu Extension License`
   - Homepage URL：填写你的GitHub仓库地址
   - Authorization callback URL：可以填写同一个仓库地址
   - 创建后进入应用设置并启用 `Enable Device Flow`
6. 复制OAuth App的Client ID。不要把Client Secret写入扩展，也不要发给任何人。
7. 返回所有者管理包，双击 `一键配置并打包.bat`，依次输入GitHub用户名、仓库名和Client ID。

## 给用户签发授权

1. 只把配置脚本生成的 `Temu助手-授权版-发给用户.zip` 发给用户。
2. 用户解压安装扩展，点击 `登录GitHub`，在GitHub页面输入验证码。
3. 用户重新打开扩展并点击 `完成登录`。
4. 用户点击 `复制授权信息`，把GitHub用户名、数字用户ID、浏览器安装码发给你。
5. 打开本仓库的 `Actions > 管理扩展授权 > Run workflow`。
6. 选择 `issue`，填写用户ID、用户名、安装码和到期日期，运行工作流。
7. 工作流完成后，用户点击扩展里的 `在线检查授权` 即可使用。

## 撤销或续期

- 撤销：再次运行 `管理扩展授权`，操作选择 `revoke`，填写GitHub用户ID和用户名。
- 续期：重新运行并选择 `issue`，使用同一个浏览器安装码并填写新的到期日期。
- 换电脑：新电脑会产生新的安装码，需要重新签发。

## 安全注意

- 永远不要上传或转发 `OWNER_PRIVATE_KEY.pem`。
- 永远不要把GitHub Client Secret、PAT或账号密码写进扩展。
- 公开仓库里只有公钥验证结果和哈希后的设备信息，没有GitHub访问令牌。
- 扩展允许最多24小时离线使用；联网后会读取最新授权，因此撤销不是即时的，最迟在离线宽限结束后生效。
- 解压扩展的JavaScript源码对收件人可见，本方案用于阻止普通转发。若对方有能力修改源码，必须把核心功能迁移到你控制的服务器才能进一步防护。
