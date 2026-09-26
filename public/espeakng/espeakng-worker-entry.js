self.Module = {
  locateFile: function (path) {
    return new URL(path, self.location.href).href;
  },
};
importScripts('espeakng.worker.js');
