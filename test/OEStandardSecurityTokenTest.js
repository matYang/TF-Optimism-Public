const BN = require('bn.js');
const BigNumber = require('bignumber.js');

const assertError = require('./assertError.js');

const OEStandardSecurityToken = artifacts.require('OEStandardSecurityToken');

const ApprovingTransferController = artifacts.require('ApprovingTransferController');
const HaltingTransferController = artifacts.require('HaltingTransferController');

const NOPTransferHook = artifacts.require('NOPTransferHook');
const CoreCodeDefinitions = artifacts.require('CoreCodeDefinitions');

const decimalPadding = '000000000000000000';
const zeroAddress = '0x0000000000000000000000000000000000000000';

const l1TokenAddr = '0x4245652cA2CDE2819Cf89Cf377799dd486C069Dd';
const l2BridgeAddr = '0x50EB44e3a68f1963278b4c74c6c343508d31704C'; // Kovan bridge, mainnet is 0x2e985AcD6C8Fa033A4c5209b0140940E24da7C5C

contract('OEStandardSecurityToken', (accounts) => {
  let tested;
  let approvingTransferController;
  let haltingTransferController;
  let nopTransferHook;
  let coreCodeDefinitions;

  beforeEach(async () => {
    approvingTransferController = await ApprovingTransferController.new();
    haltingTransferController = await HaltingTransferController.new();

    nopTransferHook = await NOPTransferHook.new();
    coreCodeDefinitions = await CoreCodeDefinitions.new();

    tested = await OEStandardSecurityToken.new(
      BigNumber(1e+18),
      haltingTransferController.address,
      coreCodeDefinitions.address,
      nopTransferHook.address,
      'OEStandardSecurityToken',
      'OEToken',
      18,
      l1TokenAddr,
      l2BridgeAddr,
      { gas: 5000000 }
    );
  });

  it('basic info is correct', async () => {
    const name = await tested.name.call();
    assert.equal('OEStandardSecurityToken', name);

    const symbol = await tested.symbol.call();
    assert.equal('OEToken', symbol);

    const l1Token = await tested.l1Token.call();
    assert.equal(l1TokenAddr, l1Token);

    const l2Bridge = await tested.l2Bridge.call();
    assert.equal(l2BridgeAddr, l2Bridge);

    const isDeployerWhitelisted = await tested.isWhitelisted.call(accounts[0]);
    assert.isTrue(isDeployerWhitelisted);

    const isL2BridgeWhitelisted = await tested.isWhitelisted.call(l2BridgeAddr);
    assert.isFalse(isL2BridgeWhitelisted);

    const totalSupply = await tested.totalSupply.call();
    assert.isTrue(totalSupply.eq(new BN(`1${decimalPadding}`)));

    const initalBalance = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(initalBalance.eq(new BN(`1${decimalPadding}`)));

    const zeroBalance = await tested.balanceOf.call(accounts[1]);
    assert.equal(0, zeroBalance.toNumber());

    const transferControllerAddress = await tested._transferController.call();
    assert.equal(haltingTransferController.address, transferControllerAddress);

    const codeDefinitionsAddress = await tested._codeDefinitions.call();
    assert.equal(coreCodeDefinitions.address, codeDefinitionsAddress);

    const transferHookAddress = await tested._transferHook.call();
    assert.equal(nopTransferHook.address, transferHookAddress);
  });

  it('whitelisted can mint', async () => {
    await assertError(tested.mint(accounts[1], 1000, { from: accounts[1] }));

    const mintTx = await tested.mint(accounts[1], 1000);
    assert.equal(true, mintTx.receipt.status);

    const balance = await tested.balanceOf.call(accounts[1]);
    assert.equal(1000, balance.toNumber());


    await assertError(tested.mint(accounts[1], 500, { from: accounts[2] }));

    const whitelistTx = await tested.addWhitelisted(accounts[2]);
    assert.equal(true, whitelistTx.receipt.status);

    const mintTx2 = await tested.mint(accounts[1], 500, { from: accounts[2] });
    assert.equal(true, mintTx2.receipt.status);

    const balance2 = await tested.balanceOf.call(accounts[1]);
    assert.equal(1500, balance2.toNumber());
  });

  it('whitelisted can burn', async () => {
    await assertError(tested.burn(accounts[0], new BigNumber(1e+17), { from: accounts[1] }));

    const burnTx = await tested.burn(accounts[0], new BigNumber(1e+17));
    assert.equal(true, burnTx.receipt.status);

    const balance = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance.toString(10) === (new BigNumber(9e+17)).toFixed());

    const burnTx2 = await tested.burn(accounts[0], new BigNumber(7e+17));
    assert.equal(true, burnTx2.receipt.status);

    const balance2 = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance2.toString(10) === (new BigNumber(2e+17)).toFixed());


    await assertError(tested.burn(accounts[0], new BigNumber(2e+17), { from: accounts[2] }));

    const whitelistTx = await tested.addWhitelisted(accounts[2]);
    assert.equal(true, whitelistTx.receipt.status);

    const burnTx3 = await tested.burn(accounts[0], new BigNumber(2e+17), { from: accounts[2] });
    assert.equal(true, burnTx3.receipt.status);

    const balance3 = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance3.toString(10) === (new BigNumber(0)).toFixed());

    await assertError(tested.burn(accounts[0], 1, { from: accounts[0] }));
  });

  it('only whitelisted can set l1 token and l2 bridge', async () => {
    await assertError(tested.setL1Token(zeroAddress, { from: accounts[1] }));
    await assertError(tested.setL2Bridge(zeroAddress, { from: accounts[1] }));

    await tested.setL1Token(zeroAddress);
    await tested.setL2Bridge(zeroAddress);

    let l1Token = await tested.l1Token.call();
    assert.equal(zeroAddress, l1Token);

    let l2Bridge = await tested.l2Bridge.call();
    assert.equal(zeroAddress, l2Bridge);

    await tested.addWhitelisted(accounts[1]);

    let tx = await tested.setL1Token(l1TokenAddr, { from: accounts[1] });
    assert.equal(true, tx.receipt.status);

    tx = await tested.setL2Bridge(l2BridgeAddr, { from: accounts[1] });
    assert.equal(true, tx.receipt.status);

    l1Token = await tested.l1Token.call();
    assert.equal(l1TokenAddr, l1Token);

    l2Bridge = await tested.l2Bridge.call();
    assert.equal(l2BridgeAddr, l2Bridge);
  });

  it('bridge can mint and burn', async () => {
    await assertError(tested.mint(accounts[0], 1000, { from: accounts[2] }));
    await assertError(tested.burn(accounts[0], 1000, { from: accounts[2] }));

    await assertError(tested.setL2Bridge(accounts[1], { from: accounts[2] }));

    await tested.setL2Bridge(accounts[2]);


    const mintTx = await tested.mint(accounts[1], 1000, { from: accounts[2] });
    assert.equal(true, mintTx.receipt.status);

    let balance = await tested.balanceOf.call(accounts[1]);
    assert.equal(1000, balance.toNumber());

    const burnTx = await tested.burn(accounts[1], 1000, { from: accounts[2] });
    assert.equal(true, burnTx.receipt.status);

    balance = await tested.balanceOf.call(accounts[1]);
    assert.equal(0, balance.toNumber());
  });




  /**
   * Below are tests for standard security token functions exact same as L1 except mint and burn
   */

  it('only admin can set token metaInfo ', async () => {
    let name = await tested.name.call();
    let symbol = await tested.symbol.call();
    let decimals = await tested.decimals.call();
    assert.equal('OEStandardSecurityToken', name);
    assert.equal('OEToken', symbol);
    assert.equal(18, decimals);

    await assertError(tested.setTokenMetaInfo('OnlyAdmin', 'OA', 10, { from: accounts[1] }));

    const setTokenMetaInfoTx = await tested.setTokenMetaInfo('OnlyAdmin', 'OA', 10);
    assert.equal(true, setTokenMetaInfoTx.receipt.status);

    name = await tested.name.call();
    symbol = await tested.symbol.call();
    decimals = await tested.decimals.call();
    assert.equal('OnlyAdmin', name);
    assert.equal('OA', symbol);
    assert.equal(10, decimals);
  });

  it('can detect transfer restriction', async () => {
    const code = await tested.detectTransferRestriction.call(accounts[0], accounts[0], accounts[0], 100);
    assert.equal(503, code.toNumber());

    const setTx = await tested.setTransferController(approvingTransferController.address);
    assert.equal(true, setTx.receipt.status);

    const code2 = await tested.detectTransferRestriction.call(accounts[0], accounts[0], accounts[0], 100);
    assert.equal(0, code2.toNumber());
  });

  it('can lookup message for transfer restriction', async () => {
    const message = await tested.messageForTransferRestriction.call(503);
    assert.equal('', message);

    const errorMessage = 'Halting all transfers due to system upgrade';
    const addCodeTx = await coreCodeDefinitions.addCode(503, errorMessage);
    assert.equal(true, addCodeTx.receipt.status);

    const message2 = await tested.messageForTransferRestriction.call(503);
    assert.equal(errorMessage, message2);
  });

  it('only owner can set transfer controller', async () => {
    const setTx = await tested.setTransferController(haltingTransferController.address);
    assert.equal(true, setTx.receipt.status);

    await assertError(tested.setTransferController(haltingTransferController.address, { from: accounts[1] }));
  });

  it('only owner can set code definitions', async () => {
    const setTx = await tested.setCodeDefinitions(coreCodeDefinitions.address);
    assert.equal(true, setTx.receipt.status);

    await assertError(tested.setCodeDefinitions(coreCodeDefinitions.address, { from: accounts[1] }));
  });

  it('only owner can set transfer hooks', async () => {
    const setTx = await tested.setTransferHook(nopTransferHook.address);
    assert.equal(true, setTx.receipt.status);

    await assertError(tested.setTransferHook(nopTransferHook.address, { from: accounts[1] }));
  });

  it('cannot transfer with transfer restriction', async () => {
    await assertError(tested.transfer(accounts[1], new BigNumber(1e+17)));
  });

  it('cannot transferFrom with transfer restriction', async () => {
    const allowTx = await tested.increaseAllowance(accounts[1], 100);
    assert.equal(true, allowTx.receipt.status);

    await assertError(tested.transferFrom(accounts[0], accounts[1], 10, { from: accounts[1] }));
  });

  it('can transfer', async () => {
    const setTx = await tested.setTransferController(approvingTransferController.address);
    assert.equal(true, setTx.receipt.status);

    await tested.transfer(accounts[1], new BigNumber(1e+17));
    await tested.transfer(accounts[2], new BigNumber(5e+17));
    await tested.transfer(accounts[3], new BigNumber(0));

    const balance0 = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance0.toString(10) === (new BigNumber(4e+17)).toFixed());

    const balance1 = await tested.balanceOf.call(accounts[1]);
    assert.isTrue(balance1.toString(10) === (new BigNumber(1e+17)).toFixed());

    const balance2 = await tested.balanceOf.call(accounts[2]);
    assert.isTrue(balance2.toString(10) === (new BigNumber(5e+17)).toFixed());

    const balance3 = await tested.balanceOf.call(accounts[3]);
    assert.isTrue(balance3.toString(10) === (new BigNumber(0)).toFixed());

    await assertError(tested.transfer(accounts[2], new BigNumber(5e+17), 10));
  });

  it('can trasnferFrom', async () => {
    const setTx = await tested.setTransferController(approvingTransferController.address);
    assert.equal(true, setTx.receipt.status);

    await tested.increaseAllowance(accounts[1], new BigNumber(2e+17));
    await tested.increaseAllowance(accounts[2], new BigNumber(2e+17));
    await tested.increaseAllowance(accounts[2], new BigNumber(2e+17), { from: accounts[1] });

    await tested.transferFrom(accounts[0], accounts[1], new BigNumber(2e+17), { from: accounts[1] });
    await tested.transferFrom(accounts[0], accounts[2], new BigNumber(1e+17), { from: accounts[2] });
    await tested.transferFrom(accounts[1], accounts[2], new BigNumber(1e+17), { from: accounts[2] });

    const balance0 = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance0.toString(10) === (new BigNumber(7e+17)).toFixed());

    const balance1 = await tested.balanceOf.call(accounts[1]);
    assert.isTrue(balance1.toString(10) === (new BigNumber(1e+17)).toFixed());

    const balance2 = await tested.balanceOf.call(accounts[2]);
    assert.isTrue(balance2.toString(10) === (new BigNumber(2e+17)).toFixed());

    const allowance01 = await tested.allowance.call(accounts[0], accounts[1]);
    assert.isTrue(allowance01.toString(10) === (new BigNumber(0)).toFixed());

    const allowance02 = await tested.allowance.call(accounts[0], accounts[2]);
    assert.isTrue(allowance02.toString(10) === (new BigNumber(1e+17)).toFixed());

    const allowance12 = await tested.allowance.call(accounts[1], accounts[2]);
    assert.isTrue(allowance12.toString(10) === (new BigNumber(1e+17)).toFixed());


    await tested.decreaseAllowance(accounts[2], new BigNumber(1e+17));
    await assertError(tested.transferFrom(accounts[0], accounts[2], new BigNumber(1e+17), { from: accounts[2] }));
  });

  it('default function is not payable', async () => {
    await assertError(tested.send(1e+18));
  });

  it('can metaTrasnfer', async () => {
    const setTx = await tested.setTransferController(approvingTransferController.address);
    assert.equal(true, setTx.receipt.status);
    await tested.transfer(accounts[1], new BigNumber(5e+17));

    const tokenAddress = tested.address;
    const method = 'metaTransfer';
    let receiver = accounts[2];
    let valueBN = new BigNumber(2e+17);
    let value = valueBN.toNumber();

    let nonceBN = await tested.replayNonce.call(accounts[1]);
    let nonce = nonceBN.toNumber();

    let message = web3.utils.soliditySha3(
      { t: 'address', v: tokenAddress },
      method,
      { t: 'address', v: receiver },
      value,
      nonce
    );
    // meta transaction from account 1 to account 2
    let sig = await web3.eth.sign(message, accounts[1]);
    let signature = sig.substr(2); // remove 0x
    let r = `0x${signature.slice(0, 64)}`;
    let s = `0x${signature.slice(64, 128)}`;
    let v = `0x${signature.slice(128, 130)}`;
    let vDecimal = parseInt(v, 16);
    if (vDecimal < 27) {
      vDecimal += 27;
    }

    // meta transactions cannot be misused
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, new BigNumber(nonce + 1)));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, new BigNumber(value + 1e+17), nonceBN));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], accounts[0], valueBN, nonceBN));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[0], receiver, valueBN, nonceBN));
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN));

    // submit meta transaction from account 0
    const metaTx1 = await tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN);
    assert.equal(true, metaTx1.receipt.status);

    const balance0 = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance0.toString(10) === (new BigNumber(5e+17)).toFixed());

    const balance1 = await tested.balanceOf.call(accounts[1]);
    assert.isTrue(balance1.toString(10) === (new BigNumber(3e+17)).toFixed());

    const balance2 = await tested.balanceOf.call(accounts[2]);
    assert.isTrue(balance2.toString(10) === (new BigNumber(2e+17)).toFixed());

    // meta tranactions cannot be replayed
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, new BigNumber(nonce + 1)));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN, { from: accounts[1] }));

    let newNonce = await tested.replayNonce.call(accounts[1]);
    assert.isTrue(newNonce.toString(10) === (new BigNumber(1)).toFixed());

    // send meta again to ensure nonce logic is correct
    receiver = accounts[3];
    valueBN = new BigNumber(1e+17);
    value = valueBN.toNumber();
    nonceBN = await tested.replayNonce.call(accounts[1]);
    nonce = nonceBN.toNumber();

    message = web3.utils.soliditySha3(
      { t: 'address', v: tokenAddress },
      method,
      { t: 'address', v: receiver },
      value,
      nonce
    );

    // meta transaction from account 1 to account 2
    sig = await web3.eth.sign(message, accounts[1]);
    signature = sig.substr(2); // remove 0x
    r = `0x${signature.slice(0, 64)}`;
    s = `0x${signature.slice(64, 128)}`;
    v = `0x${signature.slice(128, 130)}`;
    vDecimal = parseInt(v, 16);
    if (vDecimal < 27) {
      vDecimal += 27;
    }

    const metaTx2 = await tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN);
    assert.equal(true, metaTx2.receipt.status);

    const balance21 = await tested.balanceOf.call(accounts[1]);
    assert.isTrue(balance21.toString(10) === (new BigNumber(2e+17)).toFixed());

    const balance22 = await tested.balanceOf.call(accounts[3]);
    assert.isTrue(balance22.toString(10) === (new BigNumber(1e+17)).toFixed());

    // meta tranactions cannot be replayed
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, new BigNumber(nonce + 1)));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], receiver, valueBN, nonceBN, { from: accounts[1] }));

    newNonce = await tested.replayNonce.call(accounts[1]);
    assert.isTrue(newNonce.toString(10) === (new BigNumber(2)).toFixed());
  });

  it('can metaApprove', async () => {
    const setTx = await tested.setTransferController(approvingTransferController.address);
    assert.equal(true, setTx.receipt.status);
    await tested.transfer(accounts[1], new BigNumber(5e+17));

    const tokenAddress = tested.address;
    const method = 'metaApprove';
    const spender = accounts[0];
    const valueBN = new BigNumber(6e+17);
    const value = valueBN.toNumber();

    const nonceBN = await tested.replayNonce.call(accounts[1]);
    const nonce = nonceBN.toNumber();

    const message = web3.utils.soliditySha3(
      { t: 'address', v: tokenAddress },
      method,
      { t: 'address', v: spender },
      value,
      nonce
    );
    // meta transaction from account 1 to account 2
    const sig = await web3.eth.sign(message, accounts[1]);
    const signature = sig.substr(2); // remove 0x
    const r = `0x${signature.slice(0, 64)}`;
    const s = `0x${signature.slice(64, 128)}`;
    const v = `0x${signature.slice(128, 130)}`;
    let vDecimal = parseInt(v, 16);
    if (vDecimal < 27) {
      vDecimal += 27;
    }

    // meta transactions cannot be misused
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], spender, valueBN, new BigNumber(nonce + 1)));
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], spender, new BigNumber(1e+20), nonceBN));
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], accounts[2], valueBN, nonceBN));
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[0], spender, valueBN, nonceBN));
    await assertError(tested.metaTransfer(vDecimal, r, s, accounts[1], spender, valueBN, nonceBN));

    // submit meta transaction from account 0
    const metaTx1 = await tested.metaApprove(vDecimal, r, s, accounts[1], spender, valueBN, nonceBN);
    assert.equal(true, metaTx1.receipt.status);

    const allowance0 = await tested.allowance.call(accounts[1], accounts[0]);
    assert.isTrue(allowance0.toString(10) === (valueBN).toFixed());

    await tested.transferFrom(accounts[1], accounts[2], new BigNumber(3e+17));

    const allowance1 = await tested.allowance.call(accounts[1], accounts[0]);
    assert.isTrue(allowance1.toString(10) === (new BigNumber(3e+17)).toFixed());

    const balance0 = await tested.balanceOf.call(accounts[0]);
    assert.isTrue(balance0.toString(10) === (new BigNumber(5e+17)).toFixed());

    const balance1 = await tested.balanceOf.call(accounts[1]);
    assert.isTrue(balance1.toString(10) === (new BigNumber(2e+17)).toFixed());

    const balance2 = await tested.balanceOf.call(accounts[2]);
    assert.isTrue(balance2.toString(10) === (new BigNumber(3e+17)).toFixed());

    // meta tranactions cannot be replayed
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], spender, valueBN, nonceBN));
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], spender, valueBN, new BigNumber(nonce + 1)));
    await assertError(tested.metaApprove(vDecimal, r, s, accounts[1], spender, valueBN, nonceBN, { from: accounts[1] }));

    const newNonce = await tested.replayNonce.call(accounts[1]);
    assert.isTrue(newNonce.toString(10) === (new BigNumber(1)).toFixed());
  });
});
