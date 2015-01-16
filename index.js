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

module.exports = mixin(
    function(options) {
        this._rootModule = {};
        this._rootModule[MODULE_CHILDREN] = ko.observableArray(); 

        this._modules = {};

        this.options = _.extend({}, this.options, options);
    },
    {
        options: {
            moduleRootPath: 'module/page',
            moduleViewTemplate: '<!-- ko if:' + ACTIVE_PLACEHOLDER + ' -->' + CONTENT_PLACEHOLDER + '<!-- /ko -->'
        },

        // override this to customize instantiation
        instantiateModule: function(Class) {
            return new Class();
        },

        // override this to customize view
        onContentMissing: function(path) {
            var module = {};
            module[MODULE_VIEW] = '<h1>Page not found</h1><h2>' + path + '</h2>';
            module[USE_LAYOUT_PROP] = false;
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

        getLayoutClasses: function(path) {
            var self = this;
            var parentDir = '';
            var ret = [];
            path.split('/').slice(0, -1).forEach(function(dirname) {   
                parentDir += (parentDir ? '/' : '') + dirname;
                var LayoutClass = self.getModuleClass(parentDir + '/' + LAYOUT_FILE_NAME);
                if (LayoutClass) {
                    ret.push(LayoutClass);
                }
            }, []);
            return ret;
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