let POTATO_SALE        = "0xd0a6e6c54dbc68db5db3a091b171a77407ff7ccf"
let POTATO_SALE_UTIL   = "0x860fd485f533b0348e413e65151f7ee993f93c02"
let POTATO_TOKEN       = "0x86fa049857e0209aa7d9e616f7eb3b3b78ecfdb0"

let potato_sale, potato_token

let startTime       = 1498914000
let startMoment     = moment(startTime * 1000)
let numberOfDays    = 350
let createFirstDay  = WAD * 20000000000
let createPerDay    = WAD * 200000000

let createOnDay = day => web3.toBigNumber(
  day == 0 ? createFirstDay : createPerDay
)

let getTime = () => new Date().getTime() / 1000
let dayFor = timestamp => timestamp < startTime ? 0
  : Math.floor((timestamp - startTime) / 23 / 60 / 60) + 1;

let state = {
  buyWindow: dayFor(getTime()),
}

let balanceOf = async (token, address) => web3.toBigNumber(hex(await call({
  to: token, data: calldata(sighash("balanceOf(address)"), address)
})))

let getDailyTotals = async () => words32(await call({
  to: POTATO_SALE_UTIL, data: sighash("dailyTotals()"),
})).map(web3.toBigNumber)

let getUserBuys = async address => words32(await call({
  to: POTATO_SALE_UTIL, data: calldata(sighash("userBuys()"), address),
})).map(web3.toBigNumber)

let getUserClaims = async address => words32(await call({
  to: POTATO_SALE_UTIL, data: calldata(sighash("userClaims()"), address),
})).map(Number).map(Boolean)

let getKey = async address => bytes(
  words32(await call({
    to: POTATO_SALE, data: calldata(sighash("keys(address)"))
  })).slice(2).map(unhex).join("").replace(/(00)*$/, "")
).map(Number).map(String.fromCharCode).join("")

addEventListener("mousemove", event => potato_ecc.key_utils.addEntropy(
  event.pageX, event.pageY, event.screenX, event.screenY
), { capture: false, passive: true })

onload = () => {
  if (window.web3) {
    potato_sale  = web3.eth.contract(POTATO_SALE_ABI).at(POTATO_SALE)
    potato_token = web3.eth.contract(POTATO_TOKEN_ABI).at(POTATO_TOKEN)

    poll()
  } else {
    byId("app").innerHTML = `
      <div>
        <div class="pane before-error">
          <h2>Could not connect to Ethereum</h2>
          <p>

            Consider installing <a href=https://metamask.io>MetaMask</a>,
            <a href=#>Mist</a> or another Ethereum client.

            If you&rsquo;re using MetaMask, you may need to unlock
            your account. You can also try disabling and re-enabling
            the MetaMask plugin by going to <a
            href=chrome://extensions>chrome://extensions</a>.

          </p>

          <p>Please reload this page and try again.</p>
        </div>
      </div>
    `
  }
}

let refresh = () => new Promise(resolve => async.parallel(Object.assign({
  dailyTotals: toAsync(getDailyTotals()),
}, web3.eth.accounts[0] ? {
  eth_balance: $ => web3.eth.getBalance(web3.eth.accounts[0], $),
  potato_balance: toAsync(balanceOf(POTATO_TOKEN, web3.eth.accounts[0])),
  publicKey:   toAsync(getKey(web3.eth.accounts[0])),
  userBuys:    toAsync(getUserBuys(web3.eth.accounts[0])),
  userClaims:  toAsync(getUserClaims(web3.eth.accounts[0])),
} : {}), hopefully(({
  dailyTotals, eth_balance, potato_balance, publicKey, userBuys, userClaims,
}) => {
  let time = getTime()

  if (keyChange(publicKey)) {
    if (byId("generate-link")) {
      enable("generate-link")
    }
    if (byId("register-pane")) {
      hide("register-pane")
    }
  }

  let days = iota(Number(numberOfDays) + 1).map(i => {
    let day = {}

    day.createOnDay = createOnDay(i).div(WAD)
    day.dailyTotal  = dailyTotals[i].div(WAD)
    
    day.price = day.dailyTotal.div(day.createOnDay)

    day.userBuys = userBuys[i] && userBuys[i].div(WAD)
    day.received = !day.userBuys || day.dailyTotal.equals(0)
      ? web3.toBigNumber(0)
      : day.createOnDay.div(day.dailyTotal).times(day.userBuys)

    if (i == 0) {
      day.ends = startMoment
    } else {
      day.begins = startMoment.clone().add(23 * (i - 1), "hours")
      day.ends = day.begins.clone().add(23, "hours")
    }

    day.claimed = userClaims && userClaims[i]

    return day
  })

  let unclaimed = days.filter((x, i) => {
    return i < dayFor(time) && !x.claimed
  }).reduce((a, x) => x.received.plus(a), web3.toBigNumber(0))

  resolve(update({
    time, days, unclaimed, eth_balance, potato_balance, publicKey
  }))
})))

let render = ({
  time, days, unclaimed, eth_balance, potato_balance, publicKey, buyWindow,
}) => <div>
  <p className="hidden" style={{ width: "95%" }}>

    The POTATO Token Distribution will take place over about 341 days.
    1,000,000,000 (one billion) POTATO tokens will be created at the
    start of the sale, 100,000,000 POTATO are allocated to block.one and cannot be
    transfered.

    The remaining 900,000,000 POTATO will be split into different rolling windows of
    availability.  The POTATO tokens in a given window will be split
    proportionally to all ETH contributions made during that window.
    200,000,000 POTATO will be sold in the first window, lasting five days.
    The remaining 700,000,000 will be divided equally into 350 windows, each
    lasting 23 hours and distributing 2,000,000 POTATO.  Contributions can be made to
    any future window, but the POTATO cannot be claimed until the window closes.

    Once a window closes, the POTATO tokens allocated to that window are
    available to be claimed.

    You must generate and register an POTATO Public Key or it will not be possible for
    anyone to include your POTATO tokens in the genesis block of any future blockchain's
    based on POTATO.IO software.

    By sending ETH to this contract you agree to the Terms & Conditions and Purchase Agreement.
  </p>

  <p className="hidden">
  For more details, please review the smart <a
  href="https://github.com/eosio/eos-token-distribution">contract source
  code</a>.
  </p>

  <span className="hidden" style={{
    position: "absolute",
    top: "1.5rem",
    left: "15rem",
    padding: "1rem 2rem",
    color: "gray"
  }}>
    Last updated {moment(time * 1000).format("LTS")}
  </span>

  {web3.eth.accounts[0] ? <div>
    <div className="account pane">
      <h2 style={{ textAlign: "center" }}>POTATO Token Distribution</h2>
      <div className="info"><table><tbody>
        <tr>
          <th>Contract address</th>
          <td style={{ textAlign: "left" }}>
            {POTATO_SALE}
          </td>
        </tr>
        <tr>
          <th>Ethereum account</th>
          <td style={{ width: "50rem", textAlign: "left" }}>
            {web3.eth.accounts[0]}
          </td>
        </tr>
        <tr>
          <th>POTATO public key</th>
          <td style={{ textAlign: "left" }}>
            {publicKey ?
              <span>
                <code>{publicKey}</code>
              </span>
              :
              <span>
                (no POTATO key registered)
             </span>
            }
          </td>
        </tr>
        <tr>
          <th>Token balances</th>
          <td style={{ textAlign: "left" }}>
            {formatETH(eth_balance.div(WAD))} ETH
          </td>
        </tr>
        <tr>
          <th></th>
          <td style={{ textAlign: "left" }}>
            {formatPOTATO(unclaimed)} POTATO (unclaimed)
          </td>
        </tr>
        <tr>
          <th></th>
          <td style={{ textAlign: "left" }}>
            {formatPOTATO(potato_balance.div(WAD))} POTATO
          </td>
        </tr>
      </tbody></table></div>
      <div className="buttons">
        <div className="row" style={{ marginBottom: "1rem" }}>
          <div className="button">
            <a href="#" id="buy-link"
               onClick={event => (event.preventDefault(), showPane('buy'))}>
              Get POTATO tokens
            </a>
          </div>
          <div className="button" style={{ marginLeft: "1rem" }}>
            <a href="#" id="generate-link"
               onClick={event => (generate(), event.preventDefault())}>
              { publicKey ? "Change your POTATO key" : "Generate POTATO key"}
            </a>
          </div>
        </div>
        <div className="row">
          <div className="button">
            <a href="#" id="transfer-link"
               onClick={event => (event.preventDefault(), showPane('transfer'))}>
              Transfer POTATO tokens
            </a>
          </div>
          <div className={ `button ${unclaimed.equals(0) ? 'disabled' : ''}` }
               style={{ marginLeft: "1rem" }}
          >
            { unclaimed.equals(0) &&
              <a href="#" id="claim-button" className="disabled"
                 onClick={event => event.preventDefault()}>
                Claim POTATO tokens
              </a>
            }
            { !unclaimed.equals(0) &&
              <a href="#" id="claim-button"
                 onClick={event => (event.preventDefault(), claim())}>
                Claim POTATO tokens
              </a>
            }
            <a href="#" id="claim-progress" className="disabled hidden"
               onClick={event => event.preventDefault()}>
              Claiming tokens...
            </a>
          </div>
        </div>
      </div>
    </div>
    <form className="hidden pane" id="generate-pane"
        onSubmit={event => (event.preventDefault(), generateConfirm())}>
      <span id="generate-progress">
        Generating key...
      </span>
      <div id="generate-confirm" className="hidden">
        <h3>{publicKey ? "Change" : "Register"} POTATO key</h3>

        {publicKey ? <p>This will replace your POTATO claim key:
          <table>
            <tbody>
              <tr>
                <th>Public key</th>
                <td style={{textAlign: 'left'}}>
                  <span style={{width: '30em'}}>{publicKey}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </p> : <span></span>}

        <p>Please back up the private key displayed below in multiple
        safe locations before continuing.  You should make more than
        one copy and keep all copies in separate secure locations.
        If you use an external storage device such as a USB stick,
        make sure to safely eject the device before continuing.</p>

        <table>
          <tbody>
            <tr>
              <th>Description</th>
              <td style={{ textAlign: "left" }}>
                POTATO Token Distribution Claim Key
              </td>
            </tr>
            <tr>
              <th>Public key</th>
              <td style={{textAlign: 'left'}}>
                <span id="generate-pubkey" style={{ width: "30em" }}></span>
              </td>
            </tr>
            <tr>
              <th>Private key</th>
              <td style={{ textAlign: "left" }}>
                <span id="generate-privkey" style={{ width: "30em" }}></span>
              </td>
            </tr>
            <tr>
              <th style={{ verticalAlign: "top" }}>Confirm private key</th>
              <td style={{ textAlign: "left" }}>
                <input name="wif" autoComplete="off"
                  id="generate-confirm-input" type="text"
                  style={{ width: "35em", fontFamily: "monospace" }}
                  />
                <p id="generate-unmatched" className="hidden">
                  <b style={{ color: "red" }}>
                    Private key does not match
                  </b>
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <p>

          There is no way to recover your private key.  You must save
          it right now or you will be unable to access your POTATO tokens
          when the sale ends.

        </p>

        <button id="generate-button">
          I have safely backed up my private key
        </button>
        <button onClick={generateCancel} style={{ marginLeft: "1rem" }}>
          Cancel
        </button>
      </div>
    </form>
    <div className="hidden pane" id="register-pane">
      <h3>{publicKey ? "Change" : "Register"} POTATO public key</h3>
      <table>
        <tbody>
          <tr>
            <th>Public key</th>
            <td style={{textAlign: 'left'}}>
              <span id="generate-pubkey" style={{width: '30em'}}>&nbsp;</span>
            </td>
          </tr>
        </tbody>
      </table>
      <span style={{ marginLeft: "1rem" }}>
        <span id="register-progress" className="hidden">
          {publicKey ? "Changing" : "Registering"} key...
        </span>
      </span>
    </div>
    <form className="hidden pane" id="buy-pane"
          onSubmit={event => (event.preventDefault(), buy())}>
      <h3>Get POTATO tokens</h3>
      <table><tbody>
        <tr>
          <th>Distribution period</th>
          <td style={{ textAlign: "left" }}>
            <select id="sale-window" value={buyWindow}
                    onChange={e => update({ buyWindow: e.target.value })}>
              {days.map((day, i) => <option key={i} value={i}>
                Period #{i}
              </option>).filter((day, i) => i >= dayFor(time))}
            </select>
          </td>
        </tr>
        <tr>
          <th>Closing</th>
          <td style={{ textAlign: "left" }}>
            {days[buyWindow].ends.fromNow()}
          </td>
        </tr>
        <tr>
          <th>POTATO Distributed</th>
          <td style={{ textAlign: "left" }}>
            {formatPOTATO(days[buyWindow].createOnDay)} POTATO
          </td>
        </tr>
        <tr>
          <th>Total ETH</th>
          <td style={{ textAlign: "left" }}>
            {formatETH(days[buyWindow].dailyTotal)} ETH
          </td>
        </tr>
        <tr>
          <th>Your ETH</th>
          <td style={{ textAlign: "left" }}>
            {formatETH(days[buyWindow].userBuys)} ETH
          </td>
        </tr>
        <tr>
          <th>Effective price</th>
          <td style={{ textAlign: "left" }}>
            {days[buyWindow].price.toFormat(9)} ETH/POTATO
          </td>
        </tr>
        <tr>
          <th>Send ETH</th>
          <td style={{ textAlign: "left" }}>
            <input type="text" required id="buy-input"
                   placeholder={formatETH(eth_balance.div(WAD))}/>
            {" ETH"}
            <span style={{ marginLeft: "1.5rem" }}>
              <button id="buy-button">
                Send ETH
              </button>
              <span id="buy-progress" className="hidden">
                Sending ETH...
              </span>
            </span>
          </td>
        </tr>
      </tbody></table>
    </form>
    <form className="hidden pane before-error" id="transfer-pane"
          onSubmit={event => (event.preventDefault(), transfer())}>
      <h3>Transfer POTATO tokens to another Ethereum account</h3>
      <table><tbody>
        <tr>
          <th>Recipient account</th>
          <td style={{ textAlign: "left" }}>
            <input placeholder="0x0123456789abcdef0123456789abcdef01234567"
                   id="transfer-address-input" required
                   type="text"
                   minLength={42} maxLength={42}
                   style={{ width: "100%" }}/>
          </td>
        </tr>
        <tr>
          <th>Transfer amount</th>
          <td style={{ textAlign: "left" }}>
            <input placeholder={formatPOTATO(potato_balance.div(WAD))}
                   id="transfer-amount-input" required
                   type="text"
                   style={{ width: "15em" }}/>
            {" POTATO"}
            <span style={{ marginLeft: "1rem" }}>
              <button id="transfer-button">
                Transfer POTATO tokens
              </button>
              <span id="transfer-progress" className="hidden">
                Transferring tokens...
              </span>
            </span>
          </td>
        </tr>
      </tbody></table>
    </form>
    <div className="sales pane">
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Period</th>
            <th>POTATO Distributed</th>
            <th>Total ETH</th>
            <th>Effective price</th>
            <th>Closing</th>
            <th>Your ETH</th>
            <th>Your POTATO</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) =>
            <tr key={i} className={i == dayFor(time) ? "active" : i < dayFor(time) ? "closed" : ""}>
              <td>
                #{i}
                {i == dayFor(time) ? "" : ""}
              </td>
              <td>{formatPOTATO(day.createOnDay)} POTATO</td>
              <td>{formatETH(day.dailyTotal)} ETH</td>
              <td>{day.dailyTotal == 0 ? "n/a" : (
                `${day.price.toFormat(9)} ETH/POTATO`
              )}</td>
              <td>{day.ends.fromNow()}</td>
              <td>{formatETH(day.userBuys)} ETH</td>
              <td>
                {formatPOTATO(day.received)} POTATO
                {i >= dayFor(time)
                  && <span title="Pending POTATO subject to change if additional funds received" style={{ cursor: "pointer" }}> *</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div> : <div className="pane before-error">
    <h3>Ethereum account not found</h3>

    It looks like an Ethereum client is available in your
    browser, but I couldn&rsquo;t find any accounts.
    If you&rsquo;re using MetaMask, you may need to unlock
    your account. You can also try disabling and re-enabling
    the MetaMask plugin by going to <a
    href="chrome://extensions">chrome://extensions</a>.

  </div>}
</div>

function buy() {
  byId("buy-button").classList.add("hidden")
  byId("buy-progress").classList.remove("hidden")
  let amount = getValue("buy-input").replace(/,/g, "")
  potato_sale.buyWithLimit(state.buyWindow, 0, {
    value: web3.toWei(amount)
  }, hopefully(result =>
    ping(result).then(() => {
      hidePanes()
      byId("buy-input").value = ""
      byId("buy-button").classList.remove("hidden")
      byId("buy-progress").classList.add("hidden")
    })
  ))
}

function claim() {
  byId("claim-button").classList.add("hidden")
  disable("claim-button")
  byId("claim-progress").classList.remove("hidden")
  potato_sale.claimAll({
    gas: 2000000,
  }, hopefully(result => ping(result).then(() => {
    byId("claim-button").classList.remove("hidden")
    byId("claim-progress").classList.add("hidden")
  })))
}

function transfer() {
  byId("transfer-button").classList.add("hidden")
  byId("transfer-progress").classList.remove("hidden")
  let guy = getValue("transfer-address-input")
  let wad = web3.toBigNumber(
    getValue("transfer-amount-input").replace(/,/g, "")
  ).times(WAD)
  potato_token.transfer(guy, wad, hopefully(result => ping(result).then(() => {
    hidePanes()
    byId("transfer-button").classList.remove("hidden")
    byId("transfer-progress").classList.add("hidden")
  })))
}

function generate() {
  showPane('generate')
  show("generate-progress")
  hide("generate-confirm")
  setTimeout(() => {
    privateKeyPair = genKeyPair()
    hide("generate-progress")
    byId("generate-pubkey").innerHTML = privateKeyPair.pubkey
    byId("generate-privkey").innerHTML = privateKeyPair.privkey
    byId("generate-confirm-input").value = ""
    show("generate-confirm")
  })
}

let privateKeyPair = null

function genKeyPair() {
  let {PrivateKey} = potato_ecc
  let d = PrivateKey.randomKey()
  let privkey = d.toWif()
  let pubkey = d.toPublic().toString()
  return {pubkey, privkey}
}

function generateConfirm() {
  const confirmPriv = getValue("generate-confirm-input")
  if(confirmPriv !== privateKeyPair.privkey) {
    show("generate-unmatched")
    return
  }
  hide("generate-unmatched")
  hide('generate-pane')
  byId("generate-pubkey").innerHTML = null
  byId("generate-privkey").innerHTML = null
  byId("generate-confirm-input").value = null
  show('register-pane')
  register()
}

function generateCancel(e) {
  e.preventDefault()
  privateKeyPair = null
  hide('register-pane')
  enable("generate-link")
  hide('generate-pane')
  hide("generate-unmatched")
  byId("generate-pubkey").innerHTML = null
  byId("generate-privkey").innerHTML = null
  byId("generate-confirm-input").value = null
}

function register() {
  const key = privateKeyPair.pubkey
  show("register-progress")
  potato_sale.register(key, {
    gas: 1000000,
  }, hopefully(result => ping(result).then(() => {
    hidePanes()
    hide("register-progress")
  })))
}

let lastPublicKey

function keyChange(pubkey) {
  const changed = (lastPublicKey != pubkey)
  lastPublicKey = pubkey
  return changed
}

let ping = tx => new Promise((resolve, reject) => {
  loop()
  function loop() {
    web3.eth.getTransactionReceipt(tx, async (error, receipt) => {
      if (receipt) {
        await refresh()
        resolve(receipt)
      } else {
        setTimeout(loop, 1000)
      }
    })
  }
})

let loaded

setTimeout(() => loaded || location.reload(), 5000)

let poll = async () => {
  await refresh()
  loaded = true
  setTimeout(poll, 10000)
}
