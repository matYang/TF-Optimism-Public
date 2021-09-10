module.exports = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return;
  }
  assert.fail('Expected error not received');
};
