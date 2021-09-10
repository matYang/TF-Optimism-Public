const assertError = require('./assertError.js');

const CoreCodeDefinitions = artifacts.require('CoreCodeDefinitions');

contract('CoreCodeDefinitions', (accounts) => {
  let tested;

  beforeEach(async () => {
    tested = await CoreCodeDefinitions.new();
  });

  it('non owner cannot add code', async () => {
    await assertError(tested.addCode(100, 'test', { from: accounts[1] }));
  });

  it('non-existing code returns empty string', async () => {
    const message = await tested.lookup.call(101);

    assert.isTrue(true, message);
  });

  it('owner can add and overwrite code', async () => {
    const addCodeTx = await tested.addCode(100, 'test');
    assert.equal(true, addCodeTx.receipt.status);

    const message = await tested.lookup.call(100);
    assert.equal(message, 'test');

    const addCodeTx2 = await tested.addCode(100, 'test2');
    assert.equal(true, addCodeTx2.receipt.status);

    const message2 = await tested.lookup.call(100);
    assert.equal(message2, 'test2');
  });

  it('can lookup messages', async () => {
    await tested.addCode(1, 'test1');
    await tested.addCode(200, 'test200');
    await tested.addCode(503, 'test503');

    const message1 = await tested.lookup.call(1, { from: accounts[1] });
    const message200 = await tested.lookup.call(200, { from: accounts[2] });
    const message503 = await tested.lookup.call(503, { from: accounts[3] });
    const messageEmpty = await tested.lookup.call(0, { from: accounts[4] });

    assert.equal(message1, 'test1');
    assert.equal(message200, 'test200');
    assert.equal(message503, 'test503');
    assert.equal(messageEmpty, '');
  });
});
