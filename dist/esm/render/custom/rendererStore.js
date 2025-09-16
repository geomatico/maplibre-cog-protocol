const store = {};
export default {
    get: (url) => {
        return store[url];
    },
    set: (url, renderer) => {
        store[url] = renderer;
    }
};
