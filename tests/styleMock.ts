// CSS module mock for Jest: returns a proxy that maps any class name to itself
// so that `styles.button` resolves to a stable string in component tests.
module.exports = new Proxy(
  {},
  {
    get: (_target, key: string) => key,
  }
);
