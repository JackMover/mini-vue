/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Utils
 * 功 能(function)：工具类方法(utils functions)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Utils {
    static isElementNode(node) {
        return (node.nodeType === 1);
    }
    static isTextNode(node) {
        return (node.nodeType === 3);
    }
    static isDirective(dir) {
        return (dir.indexOf('v-') === 0);
    }
    static isEvent(dir) {
        return (dir.indexOf('@') === 0);
    }
    static getDeepValue(obj, key) {
        let value = obj;
        const keys = key.split('.');
        keys.forEach(k => {
            value = value[k];
        });
        return value;
    }
    static setDeepValue(obj, key, val) {
        const keys = key.split('.');
        keys.forEach((k, i) => {
            if (i < keys.length-1) {
                obj = obj[k];
            } else {
                obj[k] = val;
            }
        });
    }
}
/*---------------------------------------------Module End----------------------------------------------*/

/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Vue
 * 功 能(function)：vue类(vue class)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Vue {
    constructor(options) {
        //缓存配置项项(cache options)
        this.$el = options.el || document.body;
        this.$options = options;
        const data = this.$data = options.data;
        //数据代理(proxy data)
        this.proxyData(data);
        //劫持数据(hijack data)
        this.hijackData(data);
        //编译模版、指令(compile template,direcitves)
        new Compile(this, this.$el); 
    }

    hijackData(data) {
        if (!data || typeof data !== 'object') {//递归退出的条件，exit recursive
            return;
        }
        Object.keys(data).forEach(key => {
            this.hijackData(data[key]);//递归遍历(recursive traversing)
            new Observer(data, key, data[key]);//观察数据(observe data)
        });
    }

    proxyData(data) {
        Object.keys(data).forEach(key => {
            Object.defineProperty(this, key, {
                enumerable: true,
                configurable: false,
                get() {
                    return this.$data[key];
                },
                set(newVal) {
                    this.$data[key] = newVal;
                }
            });
        });
    }
}
/*---------------------------------------------Module End----------------------------------------------*/


/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Observer
 * 功 能(function)：观察者，监视数据，收集依赖(observe data,collect dependencies)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Observer{
    constructor(data, key, val) {
        this.observe(data, key, val);
    }
    observe(data, key, val) {
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
        });
    }
}
/*---------------------------------------------Module End----------------------------------------------*/


/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Compile
 * 功 能(function)：编译模版，指令(compile template,directives)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Compile {
    constructor(vm, el) {
        this.$vm = vm;
        //找到挂载点(find mount element)
        this.$el = Utils.isElementNode(el) ? el : document.querySelector(el);
        if (this.$el) {
            //文档节点转移到内存(move document nodes to memory)
            this.$fragment = this.node2Fragment(this.$el);
            //编译节点(compile nodes)
            this.compile(this.$fragment);
            //将编译好的节点转移回问到(move compiled nodes back to document)
            this.$el.appendChild(this.$fragment);
        }
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
            if (Utils.isElementNode(node)) {//编译元素节点(compile element node)
                Array.from(node.attributes).forEach(attr => {
                    exp = attr.value;
                    dir = attr.name;
                    if (Utils.isDirective(dir)) {//编译指令(compile directive)
                        this.update(node, exp, dir.substring(2));
                        node.removeAttribute(dir);
                    } else if(Utils.isEvent(dir)) {//编译事件指令(compile event directive)
                        this.eventHandler(node, exp, dir.substring(1));
                        node.removeAttribute(dir);
                    }
                })
            } else if (Utils.isTextNode(node) && reg.test(text)) {//编译文本节点(compile text node)
                exp = RegExp.$1.trim();
                dir = 'text';
                this.update(node, exp, dir);
            }
            if (node.hasChildNodes()) {//深度编译(deep compilation)
                this.compile(node);
            }
        });
    }

    update(node, exp, dir) {
        //初始化更新(init update)
        const fn = Updater[dir+'Updater'];
        fn && fn(this.$vm, node, exp, Utils.getDeepValue(this.$vm, exp));
        //创建依赖，变化更新(create dependency,change's update)
        new Watcher(this.$vm, exp, () => {
            fn && fn(this.$vm, node, exp, Utils.getDeepValue(this.$vm, exp));
        });
    }
    //处理事件指令(handle event directive)
    eventHandler(node, exp, eType) {
        const cb = this.$vm.$options.methods && this.$vm.$options.methods[exp];
        cb && node.addEventListener(eType, cb.bind(this.$vm));
    }
}
/*---------------------------------------------Module End----------------------------------------------*/

/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Updater
 * 功 能(function)：初始化视图，响应数据变化(init views, update views once any data changes)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Updater {
    //更新v-text指令(update v-text directive)
    static textUpdater(vm, node, exp, val) {
        node.textContent = val;
    }
    //更新v-html指令(update v-html directive)
    static htmlUpdater(vm, node, exp, val) {
        node.innerHTML = val;
    }
    //更新v-model指令(update v-model directive)
    static modelUpdater(vm, node, exp, val) {
        node.value = val;
        node.addEventListener('input', e => {
            Utils.setDeepValue(vm, exp, e.target.value);
        })
    }
}
/*---------------------------------------------Module End----------------------------------------------*/


/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Dep
 * 功 能(function)：收集依赖，通知视图更新(collect dependencies,notify views to update)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Dep {
    constructor() {
        this.deps = [];
    }
    //添加依赖(add dependency)
    addDep(dep) {
        this.deps.push(dep);
    }
    //通知更新(notify to update)
    notify() {
        this.deps.forEach(dep => {
            dep.update();
        });
    }
}
/*---------------------------------------------Module End----------------------------------------------*/


/*---------------------------------------------Module Start----------------------------------------------*/
/**
 * 模块名(module name)：Watcher
 * 功 能(function)：依赖本身，响应数据变化(reactive)
 * 作 者(Author)：JackZing
 * 时 间(created time)：2019.09.02
 */
class Watcher {
    constructor(vm, exp, cb) {
        this.cb = cb;
        //开启收集(start collecting)
        Dep.target = this;
       Utils.getDeepValue(vm, exp);//调用get,Observer给每个数据都定义了getter(call getter fuction)
        //关闭收集(stop collecting)
        Dep.target = null;
    }
    //更新视图(update view)
    update() {
        this.cb();
    }
}
/*---------------------------------------------Module End----------------------------------------------*/
