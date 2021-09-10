const HaltingTransferController = artifacts.require('HaltingTransferController');

contract('HaltingTransferController', (accounts) => {
  let tested;

  beforeEach(async () => {
    tested = await HaltingTransferController.new();
  });

  it('always halt', async () => {
    let code = await tested.check.call(accounts[0], accounts[0], accounts[0], accounts[0], 1);
    assert.equal(code, 503);

    code = await tested.check.call(accounts[0], accounts[1], accounts[0], accounts[0], 0);
    assert.equal(code, 503);

    code = await tested.check.call(accounts[1], accounts[2], accounts[3], accounts[4], 10000);
    assert.equal(code, 503);
  });
});
