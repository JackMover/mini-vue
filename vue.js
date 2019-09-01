class Vue {
    constructor(options) {
        this.$el = options.el || document.body;
        this.$options = options;
        const data = this.$data = options.data;
        this.hijackData(data);
        this.$el = this.isElementNode(this.$el) ? this.$el : document.querySelector(this.$el);
        if (this.$el) {
            this.$fragment = this.node2Fragment(this.$el);
            this.compile(this.$fragment);
            this.$el.appendChild(this.$fragment);
        }
    }

    hijackData(data) {
        if (!data || typeof data !== 'object') {
            return;
        }
        Object.keys(data).forEach(key => {
            this.hijackData(data[key]);
            this.proxyData(key);
            this.observeData(data, key, data[key]);
        });
    }

    proxyData(key) {
        Object.defineProperty(this, key, {
            enumerable: true,
            configurable: false,
            get() {
                return this.$data[key];
            },
            set(newVal) {
                this.$data[key] = newVal;
            }
        })
    }

    observeData(data, key, val) {
        const dep = new Dep();
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: false,
            get() {
                if (Dep.target) {
                    dep.addDep(Dep.target);
                }
                return val;
            },
            set(newVal) {
                if (newVal === val) {
                    return;
                }
                val = newVal;
                dep.notify();
            }
        })
    }

    isElementNode(node) {
        return (node.nodeType === 1);
    }

    isTextNode(node) {
        return (node.nodeType === 3);
    }

    node2Fragment(node) {
        const fragment = document.createDocumentFragment();
        let child = null;
        while (child = node.firstChild) {
            fragment.appendChild(child);
        }
        return fragment;
    }

    compile(vNode) {
        let exp = '';
        let dir = '';
        let text = '';
        const reg = /\{\{(.*)\}\}/;
        Array.from(vNode.childNodes).forEach(node => {
            text = node.textContent;
            if (this.isElementNode(node)) {
                Array.from(node.attributes).forEach(attr => {
                    exp = attr.value;
                    dir = attr.name;
                    if (this.isDirective(dir)) {
                        this.update(node, exp, dir.substring(2));
                        node.removeAttribute(dir);
                    } else if(this.isEvent(dir)) {
                        this.eventHandler(node, exp, dir.substring(1));
                        node.removeAttribute(dir);
                    }
                })
            } else if (this.isTextNode(node) && reg.test(text)) {
                exp = RegExp.$1.trim();
                dir = 'text';
                this.update(node, exp, dir);
            }

            if (node.hasChildNodes()) {
                this.compile(node);
            }
        });
    }

    isDirective(dir) {
        return (dir.indexOf('v-') === 0);
    }

    isEvent(dir) {
        return (dir.indexOf('@') === 0);
    }

    update(node, exp, dir) {
        const fn = this[dir+'Updater'];
        fn && fn.call(this, node, exp);

        new Watcher(this, exp, () => {
            fn && fn.call(this, node, exp);
        });
    }

    eventHandler(node, exp, eType) {
        const cb = this.$options.methods && this.$options.methods[exp];
        cb && node.addEventListener(eType, cb.bind(this));
    }

    textUpdater(node, exp) {
        node.textContent = this[exp];
    }

    htmlUpdater(node, exp) {
        node.innerHTML = this[exp];
    }

    modelUpdater(node, exp) {
        node.value = this[exp];
        node.addEventListener('input', e => {
            this[exp] = e.target.value;
        })
    }
}

class Dep {
    constructor() {
        this.deps = [];
    }

    addDep(dep) {
        this.deps.push(dep);
    }

    notify() {
        this.deps.forEach(dep => {
            dep.update();
        });
    }
}

class Watcher {
    constructor(vm, exp, cb) {
        this.cb = cb;
        Dep.target = this;
        vm[exp];
        Dep.target = null;
    }

    update() {
        this.cb();
    }
}
