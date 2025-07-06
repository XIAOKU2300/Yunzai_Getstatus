// 文件路径：plugins/example
import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'

export class UsageStatusPlugin extends plugin {
  constructor() {
    super({
      name: '鸣潮流量查询',
      dsc: '通过账号密码登录查询鸣潮流量使用统计',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: '^#鸣潮流量$',
          fnc: 'checkUsage'
        }
      ],
      // 可选配置参数，方便开源后用户填自己账号密码
      config: {
        account: '',   // 里面填写你的登录账号
        password: ''   // 里面填写你的登录密码
      }
    })

    this.cachedCookie = null
    this.cookieExpire = 0
    this.cachedUsageHtml = null
    this.cachedUsageTime = 0

    this.masterQQ =   // 只允许此QQ使用指令
  }

  // 登录获取cookie，缓存1小时
  async getLoginCookie() {
    const now = Date.now()
    if (this.cachedCookie && now < this.cookieExpire) {
      return this.cachedCookie
    }

    if (!this.config.account || !this.config.password) {
      throw new Error('未配置账号或密码，请在插件配置中填写')
    }

    const loginUrl = 'http://loping151.com:9151/login'
    const formBody = new URLSearchParams()
    formBody.append('username', this.config.account)
    formBody.append('password', this.config.password)

    const res = await fetch(loginUrl, {
      method: 'POST',
      body: formBody,
      redirect: 'manual'  // 不自动跟随重定向
    })

    if (res.status !== 302) {
      throw new Error(`登录失败，状态码: ${res.status}`)
    }

    const cookies = res.headers.get('set-cookie')
    if (!cookies) {
      throw new Error('登录失败，未获取到Cookie')
    }

    // 找 session_user cookie
    const match = cookies.match(/session_user=[^;]+/)
    if (!match) {
      throw new Error('登录失败，未获取到 session_user Cookie')
    }

    const sessionCookie = match[0]

    this.cachedCookie = sessionCookie
    this.cookieExpire = now + 3600 * 1000  // 1小时有效
    return sessionCookie
  }

  // 获取 usage 页面html，缓存1分钟
  async getUsageHtml() {
    const now = Date.now()
    if (this.cachedUsageHtml && now - this.cachedUsageTime < 60 * 1000) {
      return this.cachedUsageHtml
    }

    const cookie = await this.getLoginCookie()

    const usageUrl = 'http://loping151.com:9151/usage'
    const res = await fetch(usageUrl, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      }
    })

    if (!res.ok) {
      throw new Error(`请求使用统计失败，状态码：${res.status}`)
    }

    const html = await res.text()

    this.cachedUsageHtml = html
    this.cachedUsageTime = now
    return html
  }

  async checkUsage(e) {
    if (e.user_id !== this.masterQQ) {
      return  // 非主人不响应
    }

    try {
      const html = await this.getUsageHtml()

      const getMatch = (pattern, index = 1) => {
        const match = html.match(pattern)
        return match ? match[index].trim() : '未找到'
      }

      const totalRequests = getMatch(/<div class="stat-label">总请求数<\/div>\s*<div class="stat-value[^>]*">([^<]+)<\/div>/)
      const usedTraffic = getMatch(/<div class="stat-label">已使用流量<\/div>\s*<div class="stat-value[^>]*">([^<]+)<\/div>/)
      const quota = getMatch(/<div class="stat-label">配额上限<\/div>\s*<div class="stat-value[^>]*">([^<]+)<\/div>/)
      const expire = getMatch(/<div class="stat-label">到期时间<\/div>\s*<div class="stat-value[^>]*">([^<]+)<\/div>/)
      const successRate = getMatch(/<div class="success-rate-value">([^<]+)<\/div>/)

      const result = [
        `🐱 这是鸣潮流量的使用统计喵，主人请过目：`,
        `总请求数：${totalRequests} 个`,
        `已用流量：${usedTraffic}`,
        `配额上限：${quota}`,
        `到期时间：${expire}`,
        `今天的查询成功率：${successRate} 喵`
      ].join('\n')

      await e.reply(result)
    } catch (err) {
      await e.reply(`❌ 查询失败：${err.message}`)
      this.logger.error(`[鸣潮流量插件] 异常: ${err.stack || err}`)
    }
  }
}


//全都是满满的干货斯哈斯哈---->fannet.asia
