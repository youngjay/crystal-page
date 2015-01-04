var mixin = require('mixin-class');
var ko = require('knockout');

var MODULE_CHILDREN = '__children';
var MODULE_ACTIVE = '__active';
var MODULE_VIEW = '__view';
var MODULE_PATH = '__path';

module.exports = mixin(
    function() {
        this._rootModule = {};
        this._rootModule[MODULE_CHILDREN] = ko.observableArray(); 

        this._modules = {};
    },
    {
        MODULE_PATH: 'module/page',
        USE_LAYOUT: 'useLayout',
        LAYOUT_FILE_NAME: '__layout',
        LAYOUT_CONTENT_PLACEHOLDER: '{{content}}',

        // override this to customize instantiation
        instantiateModule: function(Class) {
            return new Class();
        },

        // override this to customize view
        onMissing: function(path) {
            var module = {};
            module[MODULE_VIEW] = '<h1>Page not found</h1><h2>' + path + '</h2>';
            module[this.USE_LAYOUT] = false;
            return mixin(module);
        },

        render: function(el) {
            el.innerHTML = '<!-- ko template: { foreach: ' + MODULE_CHILDREN + ', name: function(child) { return child.' + MODULE_VIEW + ' }} --><!-- /ko -->';
            ko.applyBindings(this._rootModule, el);
        },

        active: function(path, callback) {  
            var currentModule = this._modules[path];
            if (!currentModule) {
                currentModule = this._modules[path] = this.buildModule(path);
                this._rootModule[MODULE_CHILDREN].push(currentModule);
            }

            if (this._lastActivatedModule && this._lastActivatedModule !== currentModule) {
                this._lastActivatedModule[MODULE_ACTIVE](false);
            }

            currentModule[MODULE_ACTIVE](true);

            callback(currentModule);

            this._lastActivatedModule = currentModule;
        },

        buildModule: function(path) {
            var ModuleClass = this.getContentClass(path);

            if (ModuleClass.prototype[this.USE_LAYOUT] !== false) {
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

            ModuleClass.prototype[MODULE_VIEW] = '<div data-bind="visible:' + MODULE_ACTIVE + '">' + ModuleClass.prototype[MODULE_VIEW] + '</div>';

            return ModuleClass;
        },

        applyLayoutClasses: function(Class, LayoutClasses) {
            var LAYOUT_CONTENT_PLACEHOLDER = this.LAYOUT_CONTENT_PLACEHOLDER;

            return LayoutClasses.reverse().reduce(function(Class, LayoutClass) {
                var o = {};
                o[MODULE_VIEW] = LayoutClass.prototype[MODULE_VIEW].replace(LAYOUT_CONTENT_PLACEHOLDER, Class.prototype[MODULE_VIEW])
                return mixin(LayoutClass, Class, o);
            }, Class)
        },

        getLayoutClasses: function(path) {
            var self = this;
            var parentDir = '';
            var ret = [];
            path.split('/').slice(0, -1).forEach(function(dirname) {                
                try {
                    parentDir += (parentDir ? '/' : '') + dirname;
                    var LayoutClass = self.getModuleClass(parentDir + '/' + self.LAYOUT_FILE_NAME);
                    ret.push(LayoutClass);
                } catch (e) {
                    // has no layout
                }
            }, []);
            return ret;
        },

        getContentClass: function(path) {
            try {
                return this.getModuleClass(path);
            } catch (e) {
                return this.onMissing(path);
            }
        },

        getModuleClass: function(path) {
            return require(this.MODULE_PATH + '/' + path);
        }
    }
)