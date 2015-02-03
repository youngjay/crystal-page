var mixin = require('mixin-class');
var ko = require('knockout');
var _ = require('lodash');

var LAYOUT_FILE_NAME = '__layout';

var MODULE_CHILDREN = '__children';
var MODULE_ACTIVE = '__active';
var MODULE_VIEW = '__view';
var MODULE_PATH = '__path';

var CONTENT_PLACEHOLDER = '{{content}}';
var ACTIVE_PLACEHOLDER = '{{active}}';
var USE_LAYOUT_PROP = 'useLayout';

var normalizePath = function(path) {
    return path.replace(/^\//, '').replace(/\/$/, '')
};

module.exports = mixin(
    function(options) {
        this._rootModule = {};
        this._rootModule[MODULE_CHILDREN] = ko.observableArray(); 

        this._modules = {};

        this.options = _.extend({}, this.options, options);
        this.render();
    },
    {
        options: {
            container: document.body,
            moduleRootPath: 'module',
            moduleViewTemplate: '<!-- ko if:' + ACTIVE_PLACEHOLDER + ' -->' + CONTENT_PLACEHOLDER + '<!-- /ko -->'
        },

        // override this to customize instantiation
        instantiateModule: function(Class) {
            return new Class();
        },

        // override this to customize view
        onContentMissing: function(path) {
            var module = {};
            module[MODULE_VIEW] = '<h1>Page not found</h1>';
            module[USE_LAYOUT_PROP] = false;
            return mixin(module);
        },

        render: function() {
            var el = this.options.container;
            el.innerHTML = '<!-- ko template: { foreach: ' + MODULE_CHILDREN + ', name: function(child) { return child.' + MODULE_VIEW + ' }} --><!-- /ko -->';
            ko.applyBindings(this._rootModule, el);
        },

        activate: function(path) {    

            path = normalizePath(path);

            var currentModule = this._modules[path];
            if (!currentModule) {
                currentModule = this._modules[path] = this.buildModule(path);
                this._rootModule[MODULE_CHILDREN].push(currentModule);
            }

            if (this._lastActivatedModule && this._lastActivatedModule !== currentModule) {
                this._lastActivatedModule[MODULE_ACTIVE](false);
            }

            currentModule[MODULE_ACTIVE](true);

            this._lastActivatedModule = currentModule;
            return currentModule;
        },

        buildModule: function(path) {
            var ModuleClass = this.getContentClass(path);

            if (ModuleClass.prototype[USE_LAYOUT_PROP] !== false) {
                ModuleClass = this.applyLayoutClasses(ModuleClass, this.getLayoutClasses(path))
            }

            ModuleClass = this.addActiveControl(ModuleClass);
        
            ModuleClass.prototype[MODULE_PATH] = path;

            return this.instantiateModule(ModuleClass);
        },

        addActiveControl: function(ModuleClass) {
            ModuleClass = mixin(ModuleClass, function() {
                this[MODULE_ACTIVE] = ko.observable(true);
            });

            ModuleClass.prototype[MODULE_VIEW] = this.options.moduleViewTemplate.replace(CONTENT_PLACEHOLDER, ModuleClass.prototype[MODULE_VIEW]).replace(ACTIVE_PLACEHOLDER, MODULE_ACTIVE);

            return ModuleClass;
        },

        applyLayoutClasses: function(Class, LayoutClasses) {
            return LayoutClasses.reverse().reduce(function(Class, LayoutClass) {
                var o = {};
                o[MODULE_VIEW] = LayoutClass.prototype[MODULE_VIEW].replace(CONTENT_PLACEHOLDER, Class.prototype[MODULE_VIEW])
                return mixin(LayoutClass, Class, o);
            }, Class)
        },

        getAncestorPathes: function(path) {
            return path.split('/').map(function(_, i, arr) {
                return arr.slice(0, i + 1).join('/')
            })
        },

        getLayoutClasses: function(path) {
            var ancestorPathes = this.getAncestorPathes(path).slice(0, -1).map(function(dir) {
                return dir + '/' + LAYOUT_FILE_NAME;
            });
            ancestorPathes.unshift(LAYOUT_FILE_NAME);
            var self = this;
            var layoutClasses = [];
            ancestorPathes.forEach(function(path) {
                var LayoutClass = self.getModuleClass(path);
                if (LayoutClass) {
                    layoutClasses.push(LayoutClass);
                }
            });
            return layoutClasses;
        },

        getContentClass: function(path) {     
            return this.getModuleClass(path) || this.onContentMissing(path);
        },

        // when not found module, just return undefined
        getModuleClass: function(path) {
            var modulePath = this.options.moduleRootPath + '/' + path;
            try {
                return require(modulePath);
            } catch (e) {
                // not (not found error), pass it to caller
                if (e.message.indexOf('\'' + modulePath + '\'') === -1) {
                    throw e;
                }
            }
        }
    }
)