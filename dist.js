(function() {

	// ANCHOR POLYFILLS

	// @ts-ignore (findIndex)
	if (!Array.prototype.findIndex) {
		Object.defineProperty(Array.prototype, 'findIndex', {
			value: function(predicate) {
			 // 1. Let O be ? ToObject(this value).
				if (this == null) {
					throw new TypeError('"this" is null or not defined');
				}
	
				var o = Object(this);
	
				// 2. Let len be ? ToLength(? Get(O, "length")).
				var len = o.length >>> 0;
	
				// 3. If IsCallable(predicate) is false, throw a TypeError exception.
				if (typeof predicate !== 'function') {
					throw new TypeError('predicate must be a function');
				}
	
				// 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
				var thisArg = arguments[1];
	
				// 5. Let k be 0.
				var k = 0;
	
				// 6. Repeat, while k < len
				while (k < len) {
					// a. Let Pk be ! ToString(k).
					// b. Let kValue be ? Get(O, Pk).
					// c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
					// d. If testResult is true, return k.
					var kValue = o[k];
					if (predicate.call(thisArg, kValue, k, o)) {
						return k;
					}
					// e. Increase k by 1.
					k++;
				}
	
				// 7. Return -1.
				return -1;
			},
			configurable: true,
			writable: true
		});
	}





	// ANCHOR globals/helpers

	var LIB_NAME = 'EricUILib';
	var GLOBAL_NAME = LIB_NAME;

	function warn(message) {
		console.warn(LIB_NAME + ': ' + message);
	}

	function error(message) {
		return Error(LIB_NAME + ': ' + message);
	}

	function validateHandlerPattern(pattern) {
		if (typeof pattern !== 'string')
			throw Error('pattern must be a string');
		if (pattern === '')
			throw Error('pattern must not be empty');
		if (pattern[0] !== '/')
			throw Error('pattern must have a leading slash: ' + pattern);
		if (pattern.length > 1 && pattern[pattern.length - 1] === '/')
			throw Error('pattern must not have a trailing slash: ' + pattern);
	}


	// ANCHOR types

	/**
	 * @callback ModifierCallback
	 * @param {*} currentValue - Current value of the data to modify.
	 * @returns {*} The new value.
	 */

	/**
	 * @callback SubscriptionCallback
	 * @param {*} newValue - The value the data was just updated to.
	 */

	/**
	 * @callback StateElementUpdateCallback - The "this" value of this callback is bound to the StateElement it is attached to.
	 * @param {Array.<DataState>} states - The states that trigger this callback.
	 */

	 /**
		* @callback RouteInitializer - A function that must return DOM content for a given route, provided with HREF and query params.
		* @param {string} route - route without query string
		* @param {Object.<string, string>} params - key/value path params object
		* @param {Object.<string, string>} queries - key/value query object
		*/

	/**
	 * @typedef {{
	 *    textContent: (string|number|DataState),
	 *    states: (Array.<DataState>),
	 *    update: StateElementUpdateCallback,
	 *    bindTo: DataState,
	 *    handlers: Object.<string, Function>
	 * }} StateElementOptions
	 */


	// ANCHOR DataState()
	/**
	 * Represents one piece of state.  You should not instantiate this on its own, it is meant to be used by the State() class.
	 * @constructor
	 * @alias DataState
	 * @param {*} initialValue - The value to initialize the state with.
	 */
	function DataState(initialValue) {

		/***
		 * Array of callback functions to execute when the data is updated, cannot be accessed directly.
		 * 
		 * @type {Array.<SubscriptionCallback>}
		 */
		var subscriptions = [];

		/***
		 * The current value of the data, cannot be accessed directly.
		 */
		var value = initialValue;
		
		/**
		 * Register a callback to be run when set(), modify() or update() get called on this data.
		 * 
		 * @param {SubscriptionCallback} callback
		 * @param {boolean} runImmediately - When "true", the subscription callback is run immediately upon registration, generally used to intialize a DOM element's content.
		 */
		this.subscribe = function(callback, runImmediately) {
			subscriptions.push(callback);

			if (runImmediately)
				callback(value);
		}

		/**
		 * Retrieve current state value for this data.
		 */
		this.get = function() {
			return value;
		};

		/**
		 * Set an explicit value, then execute subscriptions.
		 * 
		 * @param {*} newValue - The value to update the data with, which will be broadcast to all subscriptions.
		 */
		this.set = function(newValue) {
			value = newValue;
			this.update();
		};

		/**
		 * Update data based on its current value then execute subscription.
		 * 
		 * @param {ModifierCallback} callback - The callback to use to modify the data.
		 */
		this.modify = function(callback) {
			value = callback(value);
			this.update();
		};

		/**
		 * Change data value without executing subscriptions.  Could be used when the data is updated often but the subscribers don't need to update everytime.  Use update() to update subscribers.
		 * 
		 * @param {any} newValue - The new value.
		 */
		this.mutate = function(newValue) {
			value = newValue;
		};

		/**
		 * Execute subscriptions without modifying current value.  Meant to be used after mutate() to notify subscribers of the new value.
		 */
		this.update = function() {
			subscriptions.forEach(function(callback) {
				callback(value);
			});
		};
		
		return this;

	}


	// ANCHOR State()
	/**
	 * Represents a collection of states
	 * @constructor
	 * @alias State
	 * @param {Object.<string, *>} initialState - Key/value map of the initial values for this state.
	 */
	function State(initialState) {

		// deep copy initial state so it cannot be modified outside of this instance
		var stateCopy = (function deepCopy(inObject) {
			var outObject, value, key;
		
			if (typeof inObject !== "object" || inObject === null) {
				// return the value if inObject is not an object
				return inObject;
			}
		
			// create an array or object to hold the values
			outObject = Array.isArray(inObject) ? [] : {};
		
			for (key in inObject) {
				value = inObject[key];
		
				// Recursively (deep) copy for nested objects, including arrays
				outObject[key] = deepCopy(value);
			}
		
			return outObject;
		})(initialState);

		var dataKeys = Object.keys(stateCopy);

		/**
		 * Key/value of state objects.  Can be accessed directly if you prefer calling methods directly on data instead of on the State object itself.
		 * 
		 * @type {Object.<string, DataState>}
		 */
		this.data = {};

		// fill data object with DataStates
		dataKeys.forEach(function(key) {
			var value = stateCopy[key];
			var dataState = new DataState(value);
			Object.defineProperty(this.data, key, {
				get: function() {
					return dataState;
				},
				set: function() {
					throw Error('There was an attempt to overwrite the ' + key + ' data state');
				},
			})
		}, this);

		// private method for use with localStorage
		var serialize = function () {
			var obj = {};
			dataKeys.forEach(function(key) {
				obj[key] = this.data[key].get();
			}, this);
			return JSON.stringify(obj);
		}.bind(this);

		var loadState = function(state) {
			dataKeys.forEach(function(key) {
				this.data[key].set(state[key]);
			}, this);
		}.bind(this);

		/**
		 * Creates or loads an entry in localStorage for the entire state object.
		 * The state must be serializable for this to work correctly.
		 * A function is returned that can be used to update the state in localStorage
		 * 
		 * @param {string} name - unique name used for localStorage, prefixed with "state-ui-" to avoid naming collisions
		 * @returns {Function} - the update function used to update the state in localStorage
		 */
		this.useLocalStorage = function(name) {

			// validate name value
			if (typeof name !== 'string' || name === '') {
				throw error('(State.useLocalStorage) "name" must be a non-empty string.');
			}

			name = 'state-ui-' + name;

			// validate unique name
			if (State.localStores.indexOf(name) !== -1) {
				throw error('(State.useLocalStorage) "name" value was not unique.');
			}

			var storedState = localStorage.getItem(name);
			
			
			// attempt to load pre-existing state or initialize the localStorage
			if (storedState) {
				loadState(JSON.parse(storedState));
			} else {
				localStorage.setItem(name, serialize());
			}

			// return update function
			return function() {
				localStorage.setItem(name, serialize());
			};

		}

		/**
		 * Get the current value for a piece of state by name.
		 * 
		 * @param {string} dataName - the name you used in the initialization of the state.
		 */
		this.get = function(dataName) {
			return this.data[dataName].get();
		};
		
		/**
		 * Set the value for a piece of state by name, and execute all subscriptions.
		 * 
		 * @param {string} dataName - the name you used in the initialization of the state.
		 * @param {any} value - the value to update the state with.
		 */
		this.set = function(dataName, value) {
			this.data[dataName].set(value);
		};
		
		/**
		 * Modify the value for a piece of state by name based on its current value, and execute all subscriptions.
		 * 
		 * @param {string} dataName - the name you used in the initialization of the state.
		 * @param {ModifierCallback} modifier - the callback to modify the value with, which receives the current value as an argument.
		 */
		this.modify = function(dataName, modifier) {
			this.data[dataName].modify(modifier);
		};
		
		/**
		 * Change the value for a piece of state by name without executing subscriptions.
		 * 
		 * @param {string} dataName - the name you used in the initialization of the state.
		 * @param {any} value - the value to change the state to.
		 */
		this.mutate = function(dataName, value) {
			this.data[dataName].mutate(value);
		};
		
		/**
		 * Execute all subscriptions for either one data or all datas without updating their values.
		 * 
		 * @param {string} [dataName] - the name you used in the initialization of the state. when provided, this is the only data that update() is called on, otherwise it is called on all datas.
		 */
		this.update = function(dataName) {
			if (dataName) {
				this.data[dataName].update();
			} else {
				dataKeys.forEach(function(key) {
					this.data[key].update();
				}, this);
			}
		};
		
		/**
		 * Add a callback to be executed when set(), modify() or update() is called on the data.
		 * 
		 * @param {string} dataName - the name you used in the initialization of the state.
		 * @param {SubscriptionCallback} callback - the callback to be run, which receives the current value of the data.
		 * @param {boolean} runImmediately - when "true", the callback is run immediately in addition to at each update
		 */
		this.subscribe = function(dataName, callback, runImmediately) {
			this.data[dataName].subscribe(callback, runImmediately);
		};

		return this;

	}

	State.localStores = [];


	// ANCHOR StateElement()
	/**
	 * Create a DOM element that is tied to state in some way.
	 * @constructor
	 * @alias StateElement
	 * @tutorial StateElement
	 * @param {string|HTMLElement} elementType - An HTMLElement reference, an ID query selector string, or an HTMLElement tag name, same as would be passed to document.createElement().
	 * @param {StateElementOptions} options - Options for the element, including state bindings, CSS and HTMLElement properties.
	 */
	function StateElement(elementType, options) {

		// accept literal HTMLElement, select with an ID selector, or create a new element
		var element;
		if (elementType instanceof HTMLElement) {
			element = elementType;
		} else if (typeof elementType == 'string' && elementType.indexOf('#') === 0) {
			element = document.querySelector(elementType);
			if (!element)
				throw error('(StateElement) An ID selector was provided but the element was not found.');
		} else {
			element = document.createElement(elementType);
		}

		if (options instanceof DataState) {
			// handle passing a state instead of options by binding it

			// @ts-ignore (value)
			if (element.value !== undefined) {
				bindTo = options;
			} else {
				textContent = options;
			}
		} else if (typeof options === 'object') {
			// pull out options

			var states = options.states || null;
			var update = options.update || null;
			var textContent = options.textContent || null;
			var bindTo = options.bindTo || null;
			var handlers = options.handlers || null;
		} else {
			throw error(
				'(StateElement) "options" must be either an options object or a piece of state to bind to'
			);
		}


		// handle states
		if (states) {

			// validate the update() callback option was provided
			if (typeof update !== 'function')
				throw error('StateElement() options.states was provided without the options.update callback');

			// validate is array
			if (Array.isArray(states) === false)
				throw error('StateElement() options.states must be an array of DataStates.')
			
			// validate all items are DataStates
			// @ts-ignore (findIndex polyfill)
			var invalidItemIndex = states.findIndex(function(state) {
				return (state instanceof DataState) === false;
			});
			if (invalidItemIndex !== -1)
				throw error(
					'StateElement() options.states must be an array of DataStates, but the item provided ' +
						'at index ' + invalidItemIndex + ' was not a DataState.'
				)

			// set up subscriptions for all states to call options.update
			states.forEach(function(dataState) {
				dataState.subscribe(function() {
					update.call(element, states);
				}, false);
			});

			// call once to initlize element on creation
			update.call(element, states);

		}

		// handle textContent
		if (textContent instanceof DataState) {
			var dataState = textContent

			dataState.subscribe(function(newValue) {
				element.textContent = newValue.toString();
			}, true);
		} else if (typeof textContent === 'string' || typeof textContent === 'number') {
			element.textContent = textContent.toString();
		}

		// handle binding to a state
		if (bindTo instanceof DataState) {

			// @ts-ignore (value)
			if (element.value === undefined)
				throw error(
					'options.bindTo was provided but the element didn\'t have a ' +
						'value" property to bind to'
					);
			
			bindTo.subscribe(function(newValue) {
				// @ts-ignore (value)
				element.value = newValue.toString();
			}, true);

			element.addEventListener('input', function() {
				// @ts-ignore (value)
				bindTo.set(element.value);
			});

		}

		// handle setting up event handlers
		if (handlers) {

			if (typeof handlers !== 'object' || Array.isArray(handlers))
				throw error('(StateElement) options.handlers must be map of "eventType->handler".');

			Object.keys(handlers).forEach(function(eventType, i) {
				// register the event handler
				element.addEventListener(eventType, handlers[eventType]);
			});

		}

		return element;

	}

	// ANCHOR Route()
	/**
	 * A Route() represents a particular view in your app, and is a combination of a path (potentially with params) and an optional query.
	 * 
	 * @constructor
	 * @alias Route
	 * @param {{path: string, query: Object.<string, string|Array.<string>>, hash: string}} options - key/value pairs representing a URL query string
	 *  
	 */
	function Route({path, query, hash}) {

		validateHandlerPattern(path)

		this.path = path;
		this.query = query || {};
		this.hash = hash && hash.replace('#', '') || '';

		var that = this;

		/**
		 * @property {string}
		 * @name Route#queryString
		 * 
		 */
		Object.defineProperty(this, 'queryString', {
			get: function() {
				return '?' + Object.keys(that.query).map(function(key) {
					var value = that.query[key];

					if (Array.isArray(value)) {
						return value
							.map(function(v) {
								return key + '=' + v;
							})
							.join('&');
					} else {
						return key + '=' + that.query[key];
					}
				});
			},
			set() {
				throw Error('(Route) cannot set queryString');
			},
		});

		/**
		 * @property {string}
		 * @name Route#hashString
		 * 
		 */
		Object.defineProperty(this, 'hashString', {
			get: function() {
				return that.hash === '' ? '' : '#' + that.hash;
			}.bind(that),
			set() {
				throw Error('(Route) cannot set hashString');
			},
		});

		this.toString = function() {
			return this.path + this.queryString + this.hashString;
		};

		return this;

	}

	// parse an HREF to create a Route object.
	function parseLocation() {

		// find start of query if there is one
		var queryIndex = location.href.indexOf('?');

		// get path from href
		var querySliceIndex = queryIndex === -1 ? location.href.length : queryIndex;
		var path = location.href
			.slice(0, querySliceIndex)
			.replace(location.origin, '');

		if (location.origin === 'file://') {
			// if serving from file protocol, remove the filepath from the path and remove hash from path
			path = path.replace(location.pathname, '');
			path = path.replace('#', '');
		} else {
			// remove hash from path
			path = path.replace('/#', '');
		}

		// convert empty path to root slash
		path = path === '' ? '/' : path;

		// remove trailing slash if present (/trailing/slash/ <-)
		if (path.length > 1 && path[path.length - 1] === '/')
			path = path.slice(0, path.length - 1);

		// find the real location hash
		var hashIndex = location.href.lastIndexOf('#');
		var hashSliceLocation = hashIndex === -1 ? location.href.length : hashIndex;
		var hash = location.href.slice(hashSliceLocation);
		
		// find and build query object
		var query = {};
		var queryString = location.href.slice(querySliceIndex + 1); // omit question mark
		if (queryString) {
			queryString = queryString.replace(hash, ''); // remove location hash if there is one
			queryString.split('&').forEach(function(kv) {
				var [key, value] = kv.split('=');
				if (query[key] !== undefined) {
					if (Array.isArray(query[key]))
						query[key].push(value);
					else
						query[key] = [query[key], value];
				} else {
					query[key] = value;
				}
			});
		}

		return new Route({
			path,
			query,
			hash: hash.slice(1), // remove leading '#'
		});

	}

	// ANCHOR Router()
	/**
	 * Router() is a singleton class that lets you load content based on the current HREF.
	 * It allows you simulate a multipage app from a single page.
	 * 
	 * @constructor
	 * @alias Router
	 * @param {HTMLElement} target - the element where the desired content will be loaded for all routes
	 * 
	 */
	function Router(target) {

		if (Router.instance) {
			return Router.instance;
		}

		// private vars
		var handlers = [];
		var history = [];
		var currentRoute = '';
		var currentHistoryLength = window.history.length;

		/**
		 * Adds a route handler for the router, which loads a given element when the HREF matches a given pattern.
		 * Accepts a pattern to match and a function that will be provided with the queries and params that must return the desired content for the route.
		 * 
		 * @param {string} pattern - string to match route against.  string can use params like ":param" in place of route segments.  must start with a forward slash. ex: /route/with/:param
		 * @param {RouteInitializer} initializer - function that should create/return the DOM content to be loaded for this route
		 */
		this.addHandler = function(pattern, initializer) {

			// validate pattern
			validateHandlerPattern(pattern)

			var segMap = {};
			pattern.split('/').forEach(function(segment) {
				segMap[segment] = segMap[segment] === undefined ? 1 : segMap[segment] + 1;
			});
			var duplicateParams = [];
			Object.keys(segMap).forEach(function(segment) {
				if (segment.match(/^:[a-zA-Z]+$/) && segMap[segment] > 1) {
					duplicateParams.push(segment);
				}
			});

			if (duplicateParams.length > 0)
				throw Error('Duplicate params found: ' + duplicateParams.join(', '));

			// validate initializer
			if (typeof initializer !== 'function') 
				throw Error('(Router) initializer must be a function');

			handlers.push({ pattern: pattern, initializer: initializer });

		};

		// used internall, and exposed externally through this.go()
		function loadRoute(route, doNotPushState) {
			if ((route instanceof Route) === false)
				throw Error('(Router) route must be a Route object.')

			for (var i = 0; i < handlers.length; i++) {
				var pattern = handlers[i].pattern;

				var routeSplit = route.path.slice(1).split('/');
				var patternSplit = pattern.slice(1).split('/');

				var params = {};
				var matched = routeSplit.length === patternSplit.length && patternSplit.every(function(segment, i) {
					var paramMatch = segment.match(/^:([a-zA-Z]+)$/);
					if (paramMatch) {
						params[paramMatch[1]] = routeSplit[i];
					}
					return segment === routeSplit[i] || paramMatch;
				});

				if (!matched)
					continue;

				
				if (!doNotPushState) {
					var href = location.pathname + '#' + route.toString();
					window.history.pushState(null, '', href);
					history.push(href);
					currentRoute = href;
					currentHistoryLength = window.history.length;
				}

				var content = handlers[i].initializer(route.path, params, route.query);

				if (content instanceof HTMLElement === false)
					throw Error('(Router) initializer must return an HTMLElement.');

				target.innerHTML = '';
				target.appendChild(content);

				return;

			}

			throw Error('(Router) did not find route matching: ' + route.path)
		}

		

		/**
		 * Attempts to match a Route against a registered pattern, and generate a new view using the registered initializer.
		 *  
		 * @param {Route} route - the Route object to load that will be provided to the matched initializer
		 */
		this.go = function(route) {
			loadRoute(route);
		}

		// read from the address bar and load a route
		function loadFromURL() {
			currentRoute = location.href;

			var route = parseLocation();
			
			loadRoute(route, true);

			// navigate to hash element if present
			if (route.hash) {
				var hashElement = document.getElementById(route.hash);
				hashElement && hashElement.scrollIntoView();
			}
		};

		// load from initial page load URL
		setTimeout(loadFromURL.bind(this));

		// update on history changes
		window.addEventListener('popstate', function(event) {

			var forward = window.history.length > currentHistoryLength;
			var back = window.history.length === currentHistoryLength;
			
			currentHistoryLength = window.history.length;

			if (location.hash.length >1 && location.hash[1] !== '/') {
				switch (true) {
					case forward:
						// real hash change, perform navigation
						window.history.pushState(null, '', currentRoute + location.hash);
						currentHistoryLength = window.history.length;
						break;
					case back:
						window.history.back();
						break;
				}
			} else {
				loadFromURL.call(this);
			}

		});

		return this;

	}

	Router.instance = null;

	// ANCHOR exports

	var exports = {
		DataState: DataState,
		State: State,
		StateElement: StateElement,
		Router: Router,
		Route: Route,
	};

	// check for naming collisions and assign global references
	var namingConflicts = Object.keys(exports).filter(function(key) {
		return globalThis[key] !== undefined;
	});

	// if there are any global naming collisions with the exports
	if (namingConflicts.length > 0) {

		warn(
			'There were naming conflicts with the following global properties: ' +
				namingConflicts.join(', ') + '.  The lib will be found globally under ' + GLOBAL_NAME
		);

		if (globalThis[GLOBAL_NAME] !== undefined) {

			warn(
				'The library name is also already being used.  Please change the GLOBAL_NAME value in the ' +
					'library source to continue using this library.'
			);

		} else {

			// assign all exports to an object on the global this named by "GLOBAL_NAME"
			globalThis[GLOBAL_NAME] = exports;

		}

	} else {

		// assign all exports to global this
		Object.keys(exports).forEach(function(key) {
			globalThis[key] = exports[key];
		});

	}
})();