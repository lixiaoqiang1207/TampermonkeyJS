// ==UserScript==
// @name        bilibili直播净化
// @namespace   https://github.com/lzghzr/GreasemonkeyJS
// @version     2.0.7
// @author      lzghzr
// @description 屏蔽聊天室礼物以及关键字, 净化聊天室环境
// @supportURL  https://github.com/lzghzr/GreasemonkeyJS/issues
// @include     /^http:\/\/live\.bilibili\.com\/\d.*$/
// @require     https://github.com/jabbany/CommentCoreLibrary/raw/master/build/CommentCoreLibrary.js
// @license     MIT
// @grant       none
// @run-at      document-end
// ==/UserScript==
/// <reference path="BiLiveNoVIP.d.ts" />
/**
 * 屏蔽B站直播间聊天室内容
 * 
 * @class BiLiveNoVIP
 */
class BiLiveNoVIP {
  constructor() {
    // 加载设置
    let config = <config>JSON.parse(localStorage.getItem('blnvConfig'))
    let defaultConfig = this.defaultConfig
    if (config === null || config.version === undefined || config.version < defaultConfig.version) {
      for (let x in defaultConfig.menu) {
        try {
          defaultConfig.menu[x].enable = config.menu[x].enable
        }
        catch (error) {
          console.error(error)
        }
      }
      this.config = defaultConfig
    }
    else {
      this.config = config
    }
  }
  private W = window
  private D = document
  private DANMU_MSG: (danmu: danmuObject) => void
  private sendBeatStorm: (beat: privateBeats) => void
  private playerObject: playerObject
  // CommentCoreLibrary (//github.com/jabbany/CommentCoreLibrary) - Licensed under the MIT license
  private CM: CommentManager
  private tempWord = new Set()
  private config: config
  private defaultConfig: config = {
    version: 1474187009714,
    menu: {
      noHDIcon: {
        name: '活动标识',
        enable: false
      },
      noVIPIcon: {
        name: '老爷标签',
        enable: false
      },
      noMedalIcon: {
        name: '粉丝勋章',
        enable: false
      },
      noUserLevelIcon: {
        name: '用户等级',
        enable: false
      },
      noLiveTitleIcon: {
        name: '成就头衔',
        enable: false
      },
      noSystemMsg: {
        name: '系统消息',
        enable: false
      },
      noGiftMsg: {
        name: '礼物信息',
        enable: false
      },
      fixTreasure: {
        name: '下移宝箱',
        enable: false
      },
      replaceDanmaku: {
        name: '替换弹幕',
        enable: false
      },
      closeDanmaku: {
        name: '&nbsp;&nbsp;┣关闭弹幕',
        enable: false
      },
      popularWords: {
        name: '&nbsp;&nbsp;┣屏蔽热词',
        enable: false
      },
      beatStorm: {
        name: '&nbsp;&nbsp;┗节奏风暴',
        enable: false
      }
    }
  }
  /**
   * 开始
   */
  public Start() {
    this.AddUI()
    this.ChangeCSS()
    this.AddDanmaku()
    let elmViewerCount = this.D.querySelector('.v-bottom.dp-none')
    let viewerCountObserver = new MutationObserver(() => {
      if (this.config.menu.replaceDanmaku.enable) {
        this.ReplaceDanmaku(true)
        if (this.config.menu.popularWords.enable) this.PopularWords(true)
        if (this.config.menu.beatStorm.enable) this.BeatStorm(true)
      }
      viewerCountObserver.disconnect()
    })
    viewerCountObserver.observe(elmViewerCount, { childList: true })
  }
  /**
   * 模拟实时屏蔽
   * 
   * @private
   */
  private ChangeCSS() {
    // 获取或者插入style
    let elmStyle = <HTMLStyleElement>this.D.querySelector('#gunCSS')
    if (elmStyle === null) {
      elmStyle = this.D.createElement('style')
      elmStyle.id = 'gunCSS'
      this.D.body.appendChild(elmStyle)
    }
    //css内容
    let cssText = ''
    if (this.config.menu.noHDIcon.enable) cssText += '#chat-msg-list a[href="/hd/aki2016"] {display: none !important;}'
    if (this.config.menu.noVIPIcon.enable) cssText += '#chat-msg-list a[href="/i#to-vip"] {display: none !important;}'
    if (this.config.menu.noMedalIcon.enable) cssText += '#chat-msg-list .medal-icon {display: none !important;}'
    if (this.config.menu.noUserLevelIcon.enable) cssText += '#chat-msg-list .user-level-icon {display: none !important;}'
    if (this.config.menu.noLiveTitleIcon.enable) cssText += '#chat-msg-list a[href="/i/myTitle#list"] {display: none !important;}'
    if (this.config.menu.noSystemMsg.enable) cssText += '#chat-msg-list .system-msg, .announcement-container {display: none !important;}'
    if (this.config.menu.noGiftMsg.enable) cssText += '#chat-msg-list .gift-msg {display: none !important;} #chat-list-ctnr > .super-gift-ctnr, #gift-msg-1000 {display: none !important;} #chat-list-ctnr > #chat-msg-list {height: 100% !important;}'
    if (this.config.menu.fixTreasure.enable) cssText += '#player-container > .treasure-box-ctnr {margin: -160px 0 !important;}'
    elmStyle.innerHTML = cssText
  }
  /**
   * 添加按钮
   * 
   * @private
   */
  private AddUI() {
    // 添加按钮相关的css
    this.AddCSS()
    // 获取按钮插入的位置
    let elmDivBtns = this.D.querySelector('.btns')
    // 传说中的UI, 真的很丑
    let elmDivGun = this.D.createElement('div')
    elmDivGun.id = 'gunBut'
    let html = '滚<div id="gunMenu" class="gunHide">'
    // 循环插入内容
    for (let x in this.config.menu) {
      html += `
<div>
  <input type="checkbox" id="${x}" class="gunHide" />
	<label for="${x}"></label>
  <span>${this.config.menu[x].name}</span>
</div>`
    }
    html += '</div>'
    elmDivGun.innerHTML = html
    // 插入菜单按钮
    elmDivBtns.appendChild(elmDivGun)
    // 获取刚刚插入的DOM
    let elmDivMenu = this.D.querySelector('#gunMenu')
    // 为了和b站更搭, 所以监听body的click
    this.D.body.addEventListener('click', (ev) => {
      let evt = <HTMLElement>ev.target
      if (elmDivGun.contains(evt)) {
        if (evt === elmDivGun) elmDivMenu.classList.toggle('gunHide')
      }
      else {
        elmDivMenu.classList.add('gunHide')
      }
    })
    // 循环设置监听插入的DOM
    let replaceDanmakuCheckbox = <HTMLInputElement>this.D.querySelector('#replaceDanmaku')
    let closeDanmakuCheckbox = <HTMLInputElement>this.D.querySelector('#closeDanmaku')
    let popularWordsCheckbox = <HTMLInputElement>this.D.querySelector('#popularWords')
    let beatStormCheckbox = <HTMLInputElement>this.D.querySelector('#beatStorm')
    for (let x in this.config.menu) {
      let checkbox = <HTMLInputElement>this.D.getElementById(x)
      checkbox.checked = this.config.menu[x].enable
      checkbox.addEventListener('change', (ev) => {
        let evt = <HTMLInputElement>ev.target
        this.config.menu[evt.id].enable = evt.checked
        localStorage.setItem('blnvConfig', JSON.stringify(this.config))
        switch (evt.id) {
          case 'replaceDanmaku':
            this.ReplaceDanmaku(evt.checked)
            if (!evt.checked) {
              if (popularWordsCheckbox.checked = true) popularWordsCheckbox.click()
              if (beatStormCheckbox.checked = true) beatStormCheckbox.click()
            }
            break
          case 'closeDanmaku':
            if (evt.checked && !replaceDanmakuCheckbox.checked) replaceDanmakuCheckbox.click()
            break
          case 'popularWords':
            this.PopularWords(evt.checked)
            if (evt.checked && !replaceDanmakuCheckbox.checked) replaceDanmakuCheckbox.click()
            break
          case 'beatStorm':
            this.BeatStorm(evt.checked)
            if (evt.checked && !replaceDanmakuCheckbox.checked) replaceDanmakuCheckbox.click()
            break
          default:
            this.ChangeCSS()
            break
        }
      })
    }
  }
  /**
   * 添加弹幕层
   * 
   * @private
   */
  private AddDanmaku() {
    // 获取播放器节点
    this.playerObject = <playerObject>this.D.querySelector('#player_object')
    // 创建弹幕层
    let danmaku = this.D.createElement('div')
    danmaku.className = 'gunDanmaku'
    let danmakuContainer = this.D.createElement('div')
    danmakuContainer.className = 'gunDanmakuContainer'
    // 插入弹幕层
    danmaku.appendChild(danmakuContainer)
    this.playerObject.parentNode.appendChild(danmaku)
    this.CM = new CommentManager(danmakuContainer)
    this.CM.init()
    // 透明度
    this.CM.options.scroll.opacity = parseInt(localStorage.getItem('danmuAlpha')) / 100
    // 存在时间7s
    this.CM.options.scroll.scale = 1.75
    // 弹幕密度
    this.CM.options.limit = parseDensity(localStorage.getItem('danmuDensity'))
    // 监听视频窗口大小
    let bodyObserver = new MutationObserver(() => {
      this.CM.width = danmaku.clientWidth
      this.CM.height = danmaku.clientHeight
    })
    bodyObserver.observe(this.D.body, { attributes: true, attributeFilter: ['class'] })
    this.W.addEventListener('resize', () => {
      this.CM.width = danmaku.clientWidth
      this.CM.height = danmaku.clientHeight
    })
    // 控制条
    this.D.querySelector('#danmu-alpha-ctrl').addEventListener('input',
      (ev) => {
        this.CM.options.scroll.opacity = parseInt((<HTMLInputElement>ev.target).value) / 100
      }
    )
    this.D.querySelector('#danmu-density-ctrl').addEventListener('input',
      (ev) => {
        this.CM.options.limit = parseDensity((<HTMLInputElement>ev.target).value)
      })
    /**
     * 计算弹幕密度
     * 
     * @param {string} density
     * @returns {number}
     */
    function parseDensity(density: string) {
      let limit: number
      switch (density) {
        case '81':
          limit = 100
          break
        case '82':
          limit = 200
          break
        case '83':
          limit = 300
          break
        case '84':
          limit = 400
          break
        case '85':
          limit = 500
          break
        case '86':
          limit = 0
          break
        default:
          limit = parseInt(density)
          break
      }
      return limit
    }
  }
  /**
   * 替换弹幕
   * 
   * @private
   * @param {boolean} enable
   */
  private ReplaceDanmaku(enable: boolean) {
    if (enable) {
      this.CM.start()
      // 替换弹幕
      this.playerObject.showComments(false)
      let masterID = this.W.MASTERID
      // 获取聊天信息
      this.DANMU_MSG = this.W.protocol.DANMU_MSG
      this.W.protocol.DANMU_MSG = (json: danmuObject) => {
        if (this.config.menu.closeDanmaku.enable) {
          this.DANMU_MSG(json)
        }
        else {
          let chatText = json.info[1]
          if (!this.tempWord.has(chatText)) {
            let danmuColor = 16777215
            if (json.info[2][2] === 1) danmuColor = (json.info[2][0] === masterID) ? 6737151 : 16750592
            let danmu = {
              mode: 1,
              text: chatText,
              size: 0.25 * localStorage.getItem('danmuSize'),
              color: danmuColor,
              shadow: true
            }
            this.CM.send(danmu)
            this.DANMU_MSG(json)
          }
        }
      }
    }
    else {
      this.W.protocol.DANMU_MSG = this.DANMU_MSG
      this.CM.stop()
      this.CM.clear()
      this.playerObject.showComments(true)
    }
  }
  /**
   * 屏蔽热词
   * 
   * @private
   * @param {boolean} disable
   */
  private PopularWords(disable: boolean) {
    let popularWords = this.W.flash_popularWords()
    for (let y of popularWords) {
      (disable) ? this.tempWord.add(y) : this.tempWord.delete(y)
    }
  }
  /**
   * 屏蔽节奏风暴
   * 
   * @private
   * @param {boolean} disable
   */
  private BeatStorm(disable: boolean) {
    let getAllBeats = '/api/ajaxGetAllBeats'
    this.XHR<getAllBeats>(getAllBeats, 'json')
      .then((resolve) => {
        let publicBeats = resolve.data.public
        for (let y of publicBeats) {
          (disable) ? this.tempWord.add(y.content) : this.tempWord.delete(y.content)
        }
      })
    if (disable) {
      this.sendBeatStorm = this.W.sendBeatStorm
      this.W.sendBeatStorm = (json: privateBeats) => {
        this.tempWord.add(json.content)
      }
    }
    else {
      this.W.sendBeatStorm = this.sendBeatStorm
    }
  }
  /**
   * 添加样式
   * 
   * @private
   */
  private AddCSS() {
    let cssText = `
.gunHide {
  display: none;
}
#gunBut {
  border: 1px solid #999;
  border-radius: 50%;
  cursor: pointer;
  display: inline-block;
  font-size: 13px;
  height: 18px;
  margin: -3px 5px;
  text-align: center;
  width: 18px;
  vertical-align: text-top;
}
#gunBut > #gunMenu {
  animation:move-in-right cubic-bezier(.22,.58,.12,.98) .4s;
  background-color: #fff;
  border-radius: 5px;
  box-shadow: 0 0 2em .1em rgba(0,0,0,0.15);
  cursor: default;
  font-size: 12px;
  height: 250px;
  margin: -250px -125px;
  padding: 10px;
  position: absolute;
  width: 100px;
}
#gunBut > #gunMenu > div {
	background: darkgray;
	border-radius: 5px;
	height: 10px;
	margin: 0 0 12px 0;
	position: relative;
	width: 20px;
}
#gunBut > #gunMenu > div > label {
	background: dimgray;
	border-radius: 50%;
	cursor: pointer;
	display: block;
	height: 16px;
	left: -3px;
	position: absolute;
	top: -3px;
	transition: all .5s ease;
	width: 16px;
}
#gunBut > #gunMenu > div > input[type=checkbox]:checked + label {
  background: #4fc1e9;
	left: 7px;
}
#gunBut > #gunMenu > div > span {
  left: 0;
  margin: -3px 0 0 20px;
  position: absolute;
  width: 80px;
}
.gunDanmaku {
  position:absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 93%;
  overflow: hidden;
  z-index: 1;
  cursor: pointer;
  pointer-events: none;
}
.gunDanmaku .gunDanmakuContainer {
  transform: matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);
  position: absolute;
  display: block;
  overflow: hidden;
  margin: 0;
  border: 0;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 9999;
  touch-callout: none;
  user-select: none;
}
.gunDanmaku .gunDanmakuContainer .cmt {
  transform: matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1);
  transform-origin: 0% 0%;
  position: absolute;
  padding: 3px 0 0 0;
  margin: 0;
  color: #fff;
  font-family: "Microsoft YaHei", SimHei;
  font-size: 25px;
  text-decoration: none;
  text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black;
  text-size-adjust: none;
  line-height: 100%;
  letter-spacing: 0;
  word-break: keep-all;
  white-space: pre;
}
.gunDanmaku .gunDanmakuContainer .cmt.noshadow {
  text-shadow: none;
}
.gunDanmaku .gunDanmakuContainer .cmt.rshadow {
  text-shadow: -1px 0 white, 0 1px white, 1px 0 white, 0 -1px white;
}`
    // 插入css
    let elmStyle = this.D.createElement('style')
    elmStyle.innerHTML = cssText
    this.D.body.appendChild(elmStyle)
  }
  /**
   * 使用Promise封装xhr
   * 
   * @private
   * @template T
   * @param {string} url
   * @param {string} [type='']
   * @param {string} [method='GET']
   * @param {boolean} [cookie=false]
   * @returns {Promise<T>}
   */
  private XHR<T>(url: string, type = '', method = 'GET', cookie = false): Promise<T> {
    return new Promise((resolve, reject) => {
      // 并不需要处理错误
      let timeout = setTimeout(reject, 3e4) //30秒
      let path = url
      if (type === 'jsonp') {
        // 感觉引入jquery还是太大材小用
        let cbRandom = Math.floor(Math.random() * 1e15)
        let elmScript = this.D.createElement('script')
        this.D.body.appendChild(elmScript)
        this.W[`cb${cbRandom}`] = (json) => {
          clearTimeout(timeout)
          this.D.body.removeChild(elmScript)
          this.W[`cb${cbRandom}`] = undefined
          resolve(json)
        }
        elmScript.src = `${path}&callback=cb${cbRandom}&_=${Date.now()} `
      }
      else {
        let postData = ''
        let xhr = new XMLHttpRequest()
        if (method === 'POST') {
          path = url.split('?')[0]
          postData = url.split('?')[1]
        }
        xhr.open(method, path, true)
        if (method === 'POST') xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
        if (cookie) xhr.withCredentials = true
        xhr.responseType = type
        xhr.onload = (ev) => {
          clearTimeout(timeout)
          resolve((<XMLHttpRequest>ev.target).response)
        }
        xhr.send(postData)
      }
    })
  }
}
const gun = new BiLiveNoVIP()
gun.Start()