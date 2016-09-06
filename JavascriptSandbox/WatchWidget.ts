/// <reference path="sandbox.ts" />
enum PropertyUpdateDecision {
	Add, Remove, Update
}

/* TODO: show full inheritance chain of type when type element hovered with mouse.
 * UPD: it hard to distinguish types of objects without constructor. All their types
 * will be displayed as Object, so inheritance chain will be something like
 * Object --> Object --> Object... Isn't it useless? */
// TODO: make setting for scanInherited? Questionable feature: hard to explore objects with such a pile of props.
/* TODO: contract long values, make some means to expand their full representation. Currently values of
 * 'function' type usually take too much space horizontally.
 * UPD: native functions will be displayed in shorter fashion.
 * I think it's better to put WatchWidget into container with its 'overflow' set to 'scroll'. */
/* TODO: always set values that came from sandbox to innerText! In case of jailbreak guestCode can
 * gain control over postMessage and send malicious html-like strings which in turn can contain
 * javascript. */
class WatchWidget {
	private boundStateChangedHandler : () => void;
	private boundTerminatedEventHandler : () => void;
	public get sandbox () { return	this._sandbox; }
	public get pathRoot () { return	this._pathRoot; }
	private _autoUpdate = false;
	public get autoUpdate () { return	this._autoUpdate; }
	public set autoUpdate ( value : boolean ) {
		value = !!value;

		if ( this._autoUpdate === value )
			return;

		this._autoUpdate = value;

		if ( this._autoUpdate ) {
			this._sandbox.onStateChanged ( this.boundStateChangedHandler );
			this.update ();
		} else
			this._sandbox.off ( Sandbox.StateChangedEvent, this.boundStateChangedHandler );

		// TODO: append/remove 'watch-auto-update' class from this._rootElement.
	}
	private _label : string;
	public get label () { return	this._label; }
	public get showOnlyLabelForRoot () { return	this._showOnlyLabelForRoot; }
	private _rootElement : HTMLDivElement = null;
	public get rootElement () { return	this._rootElement; }
	private isUpdating = false;
	private updateIdx = 0;
	private rootValue : ReflectedValue = null;
	private errorElement : HTMLElement = null;
	public get isEnabled () { return	!this._rootElement.classList.contains ( 'element-disabled' ); }
	public set isEnabled ( value : boolean ) {
		value = !!value;

		if ( value && this._sandbox.isTerminated )
			return;

		if ( this.isEnabled !== value )
			WatchWidget.setClassEnabled ( this._rootElement, 'element-disabled', !value );
		else
			return;

		var eValElts = this._rootElement.querySelectorAll ( '.reflected-value' );

		for ( var i = 0 ; i < eValElts.length ; i++ ) {
			var eVal = <HTMLElement> eValElts [i],
				reflectedValue = <ReflectedValue> eVal ['eWatch']['reflectedValue'];

			this.updateValueContentEditability ( eVal, reflectedValue );
		}

		if ( this._autoUpdate )
			this.update ();
	}

	private get isSuspended () { return	this.isUpdating || !this.isEnabled || this._sandbox.isTerminated; }

	// TODO: there's too many args, move them to settings object.
	constructor ( private _sandbox : Sandbox, private _pathRoot : string,
		private _isInitiallyOpen = true, autoUpdate = false, label? : string,
		private _showOnlyLabelForRoot = false )
	{
		this._label = label !== null ? label : undefined;
		this.boundStateChangedHandler = this.stateChangedHandler.bind ( this );
		this.boundTerminatedEventHandler = this.terminatedEventHandler.bind ( this );
		_sandbox.onTerminated ( this.boundTerminatedEventHandler );
		this._rootElement = <HTMLDivElement> document.createElement ( 'div' );
		this._rootElement.className = 'watch-container';
		this.autoUpdate = autoUpdate;
		this.update ();
	}

	private stateChangedHandler () {
		this.update ();
	}

	private terminatedEventHandler () {
		this.isEnabled = false;
		this._sandbox.off ( Sandbox.TerminatedEvent, this.boundTerminatedEventHandler );

		if ( this._autoUpdate );
			this._sandbox.off ( Sandbox.StateChangedEvent, this.boundStateChangedHandler );
	}

	private update () {
		if ( this.isSuspended )
			return;
		
		this.updateIdx++;

		if ( this.rootValue === null )
			this.requestRootValue ();
		else
			this.requestUpdatedValue ( this.rootValue );
	}

	private requestRootValue () {
		this.isUpdating = true;
		var path = [this._pathRoot];

		this._sandbox.reflect ( path, this._isInitiallyOpen ? [] : null, false,
			function ( reflectedObject : ReflectedValue,
				path : string [], props : ReflectByTreeQueryNode [], scanInherited : boolean )
			{
				this.rootValue = reflectedObject;
				var eWatch = this.renderWatch ( reflectedObject, this._isInitiallyOpen, this._label );
				this._rootElement.appendChild ( eWatch );
				this.renderWatchDetails ( eWatch, reflectedObject );
			}.bind ( this ),
			this.displayError.bind ( this ),
			function () {
				this.isUpdating = false;
			}.bind ( this )
		);
	}

	private requestUpdatedValue ( reflectedValue : ReflectedValue ) {
		this.isUpdating = true;
		var eWatch = reflectedValue ['eWatch'],
			treeQuery = this.toTreeQuery ( reflectedValue );

		this._sandbox.reflect ( reflectedValue.path, treeQuery.props, false,
			function ( reflectedObject : ReflectedValue,
				path : string [], props : ReflectByTreeQueryNode [], scanInherited : boolean, valueBeingUpdated : ReflectedValue )
			{
				this.updateReflectedValueRecursively ( valueBeingUpdated, reflectedObject );
				valueBeingUpdated ['eWatch']['wasExpanded'] = true;
			}.bind ( this ),
			this.displayError.bind ( this ),
			function () {
				this.isUpdating = false;
			}.bind ( this ),
			reflectedValue
		);
	}

	private toTreeQuery ( reflectedValue : ReflectedValue ) : ReflectByTreeQueryNode {
		var node = <ReflectByTreeQueryNode> {
				name : reflectedValue.path [reflectedValue.path.length - 1],
				props : []
			},
			rProps = reflectedValue.properties;

		for ( var i = 0 ; i < rProps.length ; i++ ) {
			var rPropValue = rProps [i].value,
				pWatch = <HTMLElement> rPropValue ['eWatch'];

			if ( WatchWidget.watchElementIsOpen ( pWatch ) ) {
				var propNode = this.toTreeQuery ( rPropValue );
				node.props.push ( propNode );
			}
		}

		return	node;
	}

	private updateReflectedValueRecursively ( oldValue : ReflectedValue, newValue : ReflectedValue ) {
		this.updateReflectedValue ( oldValue, newValue );
		this.updateDetails ( oldValue, newValue );
	}

	private updateDetails ( oldReflectedValue : ReflectedValue, newReflectedValue : ReflectedValue ) {
		var oldProps = oldReflectedValue.properties,
			newProps = newReflectedValue.properties,
			eWatch = <HTMLElement> oldReflectedValue ['eWatch'],
			eWatchDetails = <HTMLElement> eWatch ['eWatchDetails'],
			i = 0, j = 0, decision : PropertyUpdateDecision;

		while ( i < oldProps.length || j < newProps.length ) {
			var pOld : ReflectedProperty = null,
				pNew : ReflectedProperty = null;

			if ( i >= oldProps.length ) {
				decision = PropertyUpdateDecision.Add;
				pNew = newProps [j];
			} else if ( j >= newProps.length ) {
				decision = PropertyUpdateDecision.Remove;
				pOld = oldProps [i];
			} else {
				pOld = oldProps [i];
				pNew = newProps [j];

				if ( pOld.name === pNew.name )
					decision = PropertyUpdateDecision.Update;
				else {
					if ( pOld.name === null )
						decision = PropertyUpdateDecision.Remove;
					else if ( pNew.name === null || pOld.name > pNew.name )
						decision = PropertyUpdateDecision.Add;
					else /*if ( pOld.name < pNew.name ) */
						decision = PropertyUpdateDecision.Remove;
				}
			}

			var pWatch = pOld !== null ? <HTMLElement> pOld.value ['eWatch'] : null;

			if ( decision === PropertyUpdateDecision.Add ) {
				pNew.parentValue = oldReflectedValue;
				oldProps.splice ( i, 0, pNew );
				var newPropWatch = this.renderWatch ( pNew.value, false, pNew.name );
				eWatchDetails.insertBefore ( newPropWatch, pWatch );	// NOTE: it's ok when pWatch is null.

				if ( eWatch ['wasExpanded'] )
					WatchWidget.markWatchAsUpdated ( newPropWatch );

				i++; j++;
			} else if ( decision === PropertyUpdateDecision.Remove ) {
				eWatchDetails.removeChild ( pWatch );
				oldProps.splice ( i, 1 );
			} else /*if ( decision === PropertyUpdateDecision.Update )*/ {
				WatchWidget.markWatchAsNormal ( pWatch );
				this.updateReflectedValue ( pOld.value, pNew.value );
				i++; j++;

				if ( WatchWidget.watchElementIsOpen ( pWatch ) )
					this.updateDetails ( pOld.value, pNew.value );
			}
		}
	}

	private updateReflectedValue ( oldValue : ReflectedValue, newValue : ReflectedValue ) {
		oldValue ['updateIdx'] = this.updateIdx;
		var eWatch = oldValue ['eWatch'],
			updateType = false;

		if ( oldValue.type !== null ) {
			if ( newValue.type !== null ) {
				updateType = oldValue.type.classType !== newValue.type.classType ||
					oldValue.type.specificType !== newValue.type.specificType;
			} else
				updateType = true;
		} else if ( newValue.type !== null )
			updateType = true;

		if ( updateType ) {
			oldValue.type = newValue.type;
			this.updateTypeElement ( eWatch ['eType'], oldValue.type );
			WatchWidget.markAsUpdated ( eWatch ['eType'] );
		} else
			WatchWidget.markAsNormal ( eWatch ['eType'] );

		oldValue.success = newValue.success;
		oldValue.hasCustomStringRepr = newValue.hasCustomStringRepr;

		if ( oldValue.value !== newValue.value ) {
			oldValue.value = newValue.value;
			this.updateValueElement ( eWatch ['eVal'], oldValue );
			WatchWidget.markAsUpdated ( eWatch ['eVal'] );
		} else if ( oldValue ['meantToBeUpdated'] ) {
			this.updateValueElement ( eWatch ['eVal'], oldValue );
			WatchWidget.markAsUpdateRejected ( eWatch ['eVal'] );
		} else
			WatchWidget.markAsNormal ( eWatch ['eVal'] );

		delete oldValue ['meantToBeUpdated'];

		if ( oldValue.hasProperties !== newValue.hasProperties ) {
			oldValue.hasProperties = newValue.hasProperties;
			var eExp = eWatch ['eExp'];
			this.updateExpanderElement ( eExp, oldValue );
		}

		var updateAttrs = false;

		if ( oldValue.parentProperty !== null && newValue.parentProperty !== null )
			updateAttrs = oldValue.parentProperty.attributes !== newValue.parentProperty.attributes;

		if ( updateAttrs ) {
			oldValue.parentProperty.attributes = newValue.parentProperty.attributes;
			this.updateLabel ( eWatch ['eLabel'], oldValue );
			WatchWidget.markAsUpdated ( eWatch ['eLabel'] );
		} else
			WatchWidget.markAsNormal ( eWatch ['eLabel'] );
	}

	private static markWatchAsUpdated ( eWatch : HTMLElement ) {
		WatchWidget.markAsUpdated ( eWatch ['eLabel'] );
		WatchWidget.markAsUpdated ( eWatch ['eVal'] );
		WatchWidget.markAsUpdated ( eWatch ['eType'] );
	}

	private static markWatchAsNormal ( eWatch : HTMLElement ) {
		WatchWidget.markAsNormal ( eWatch ['eLabel'] );
		WatchWidget.markAsNormal ( eWatch ['eVal'] );
		WatchWidget.markAsNormal ( eWatch ['eType'] );
	}

	private static markAsUpdated ( e : HTMLElement ) {
		WatchWidget.enableClass ( e, 'updated-element' );
	}

	private static markAsUpdateRejected ( e : HTMLElement ) {
		WatchWidget.enableClass ( e, 'update-rejected-element' );
	}

	private static markAsNormal ( e : HTMLElement ) {
		WatchWidget.disableClass ( e, 'updated-element' );
		WatchWidget.disableClass ( e, 'update-rejected-element' );
	}

	private static getMarkClassName ( e : HTMLElement ) {
		if ( e.classList.contains ( 'updated-element' ) )
			return	'updated-element';
		else if ( e.classList.contains ( 'update-rejected-element' ) )
			return	'update-rejected-element';
		else
			return	'';
	}

	private static watchElementIsOpen ( eWatch : HTMLElement ) {
		return	eWatch.classList.contains ( 'watch-open' );
	}

	private static enableClass ( e : HTMLElement, className : string ) {
		if ( !e.classList.contains ( className ) )
			e.classList.add ( className );
	}

	private static disableClass ( e : HTMLElement, className : string ) {
		if ( e.classList.contains ( className ) )
			e.classList.remove ( className );
	}

	private static setClassEnabled ( e : HTMLElement, className : string, enabled : boolean ) {
		if ( enabled )
			WatchWidget.enableClass ( e, className );
		else
			WatchWidget.disableClass ( e, className );
	}

	private toggleWatchExpanded ( eWatch : HTMLElement ) {
		if ( this.isSuspended )
			return;

		if ( WatchWidget.watchElementIsOpen ( eWatch ) ) {
			WatchWidget.disableClass ( eWatch, 'watch-open' );
			WatchWidget.enableClass ( eWatch, 'watch-closed' );
		} else {
			WatchWidget.disableClass ( eWatch, 'watch-closed' );
			WatchWidget.enableClass ( eWatch, 'watch-open' );
			var reflectedValue = <ReflectedValue> eWatch ['reflectedValue'];
			
			if ( !eWatch ['wasExpanded'] ||
				( this._autoUpdate && reflectedValue ['updateIdx'] < this.updateIdx ) )
			{
				this.hideError ();
				this.requestUpdatedValue ( reflectedValue );
			}
		}
	}

	private watchHeaderExpandHandler ( ev : MouseEvent ) {
		var eHeaderElt = <HTMLElement> ev.currentTarget,
			eWatch = <HTMLElement> eHeaderElt ['eWatch'],
			eExp = <HTMLElement> eWatch ['eExp'],
			isExpandable = !eExp.classList.contains ( 'element-hidden' );

		if ( isExpandable ) {
			this.toggleWatchExpanded ( eWatch );
			ev.stopPropagation ();
		}
	}

	/* TODO: think about making this and several other methods static.
	 * They do not need the knowledge about current state of Sandbox instance.
	 * UPD: they will need it when view settings get implemented. */
	private renderExpander ( reflectedValue : ReflectedValue ) {
		var eExp = document.createElement ( 'span' );
		eExp.innerHTML = '&nbsp;';
		eExp.className = 'expander-button no-text-select';
		
		eExp.addEventListener ( 'click',
			this.watchHeaderExpandHandler.bind ( this ), false );

		this.updateExpanderElement ( eExp, reflectedValue );

		return	eExp;
	}

	private updateExpanderElement ( eExp : HTMLElement, reflectedValue : ReflectedValue ) {
		if ( reflectedValue.parentProperty === null )
			WatchWidget.setClassEnabled ( eExp, 'element-collapsed', !reflectedValue.hasProperties );
		else
			WatchWidget.setClassEnabled ( eExp, 'element-hidden', !reflectedValue.hasProperties );
	}

	private updateLabel ( eLabel : HTMLElement, reflectedValue : ReflectedValue ) {
		var label : string = eLabel ['labelText'];
		
		if ( label === null ) {
			WatchWidget.enableClass ( eLabel, 'prototype-label' );
			eLabel.innerText = '[[prototype]]: ';
		} else if ( typeof label === 'string' ) {
			eLabel.innerHTML = '';
			eLabel.appendChild ( document.createTextNode ( label ) );
			var parentProperty = reflectedValue.parentProperty;

			if ( parentProperty !== null ) {
				var attrs = parentProperty.attributes,
					configurable = -1 !== attrs.indexOf ( 'c' ),
					enumerable = -1 !== attrs.indexOf ( 'e' ),
					writable = -1 !== attrs.indexOf ( 'w' ),
					hasGetter = -1 !== attrs.indexOf ( 'g' ),
					hasSetter = -1 !== attrs.indexOf ( 's' ),
					isOwn = -1 !== attrs.indexOf ( 'o' );

				WatchWidget.setClassEnabled ( eLabel, 'non-enumerable', !enumerable );

				if ( !configurable || hasGetter || hasSetter || !writable ) {
					var eAttrs = document.createElement ( 'span' );
					eAttrs.className = 'property-attributes';
					eAttrs.appendChild ( document.createTextNode ( '(' ) );

					if ( !configurable )
						eAttrs.appendChild ( document.createTextNode ( 'L' ) );

					if ( hasGetter || hasSetter || !writable ) {
						if ( !configurable )
							eAttrs.appendChild ( document.createTextNode ( ',' ) );

						if ( hasGetter )
							eAttrs.appendChild ( document.createTextNode ( 'G' ) );

						if ( hasSetter )
							eAttrs.appendChild ( document.createTextNode ( 'S' ) );

						if ( !writable && !hasGetter && !hasSetter )
							eAttrs.appendChild ( document.createTextNode ( 'R/O' ) );
					}
					
					eAttrs.appendChild ( document.createTextNode ( ')' ) );
					eLabel.appendChild ( eAttrs );
				}

				var ttText =
					'configurable : ' + configurable + '\n' +
					'enumerable : ' + enumerable + '\n';

				if ( hasGetter || hasSetter ) {
					ttText += 'hasGetter : ' + hasGetter + '\n';
					ttText += 'hasSetter : ' + hasSetter + '\n';
				} else
					ttText += 'writable : ' + writable;
				
				eLabel.title = ttText;
			}

			eLabel.appendChild ( document.createTextNode ( ': ' ) );
		}
	}

	private renderLabel ( reflectedValue : ReflectedValue, label : string ) {
		var eLabel = document.createElement ( 'span' );
		eLabel.className = 'property-label no-text-select';
		eLabel ['labelText'] = label;

		eLabel.addEventListener ( 'click',
			this.watchHeaderExpandHandler.bind ( this ), false );

		this.updateLabel ( eLabel, reflectedValue );

		return	eLabel;
	}

	private updateValueContentEditability ( eVal : HTMLElement, reflectedValue : ReflectedValue ) {
		if ( reflectedValue.success && reflectedValue.parentProperty !== null && this.isEnabled ) {
			eVal.contentEditable = true + '';
			eVal.spellcheck = false;

			var presumablyReadOnly = false;

			if ( reflectedValue.parentProperty.name === null )
				presumablyReadOnly = true;
			else {
				var attrs = reflectedValue.parentProperty.attributes,
					writable = -1 !== attrs.indexOf ( 'w' ),
					hasSetter = -1 !== attrs.indexOf ( 's' );

				if ( !writable && !hasSetter )
					presumablyReadOnly = true;
			}

			if ( presumablyReadOnly )
				WatchWidget.enableClass ( eVal, 'presumably-read-only' );
		} else
			eVal.contentEditable = false + '';
	}

	private updateValueElement ( eVal : HTMLElement, reflectedValue : ReflectedValue ) {
		eVal.className = 'reflected-value';
		this.updateValueContentEditability ( eVal, reflectedValue );

		if ( reflectedValue.success ) {
			WatchWidget.enableClass ( eVal, 'type-' + reflectedValue.type.classType );

			if ( reflectedValue.type.classType === 'String' ) {
				eVal.innerText = '"' +
					reflectedValue.value
					.replace ( /\\/g, '\\\\' )
					.replace ( /"/g, '\\"' )
					.replace ( /\r/g, '\\r' )
					.replace ( /\n/g, '\\n' )
					.replace ( /\t/g, '\\t' )
					+ '"';
			} else if ( reflectedValue.hasCustomStringRepr ) {
				/* TODO: render primitive types like bool, number, array, function
				 * with custom code. Render types having custom toString () as a
				 * strings.
				 * UPD: no, render only strings as a strings. */
				eVal.innerText = reflectedValue.value
					//.replace ( /\r/g, '␍' )
					//.replace ( /\n/g, '␤' );	// NOTE: these unicode symbols uncontrollable increases line height.

					//.replace ( /\r/g, '\\r' )
					//.replace ( /\n/g, '\\n' );
					.replace ( /[\r\n]/g, '' )
					;
			} else {
				/* TODO: if ( rValue.type.classType === 'Object' ) -> print simple representaion
				 * like { a : 5, b : { c : 'hehe', f : function } }. */
				eVal.innerText = '{…}';
			}

			eVal ['initialText'] = eVal.innerText;
		} else {
			var errSpan = document.createElement ( 'div' );
			errSpan.className = 'value-error';
			errSpan.innerText = reflectedValue.value;
			eVal.innerHTML = '';
			eVal.appendChild ( errSpan );
			eVal ['initialText'] = '';
		}
	}

	private valueEditingCancelled ( eVal : HTMLElement ) {
		var eWatch = eVal ['eWatch'],
			reflectedValue = <ReflectedValue> eWatch ['reflectedValue'],
			markClassName = WatchWidget.getMarkClassName ( eVal );
		
		this.updateValueElement ( eVal, reflectedValue );

		if ( markClassName )
			WatchWidget.enableClass ( eVal, markClassName );
	}

	private renderValue ( reflectedValue : ReflectedValue ) {
		var eVal = document.createElement ( 'span' );
		
		eVal.addEventListener ( 'keydown', function ( ev : KeyboardEvent ) {
			if ( this.isSuspended )
				return;
			
			var eVal = <HTMLElement> ev.currentTarget,
				eWatch = eVal ['eWatch'],
				reflectedValue = <ReflectedValue> eWatch ['reflectedValue'];

			if ( !reflectedValue.success )
				return;
			
			if ( ev.keyCode === 13 /* Enter */ && !ev.shiftKey ) {
				ev.preventDefault ();
				this.hideError ();
				var code = eVal.innerText;
				reflectedValue ['meantToBeUpdated'] = code !== eVal ['initialText'];
				code = '(' + code + ')';

				this._sandbox.exec ( code,
					function ( storedResultId : number, valueBeingUpdated : ReflectedValue ) {
						var dstPath = valueBeingUpdated.path;

						this._sandbox.assignInternal ( [storedResultId + ''], dstPath,
							function ( srcPath : string [], dstPath : string [], valueBeingUpdated : ReflectedValue ) {
								if ( !this._autoUpdate )
									this.requestUpdatedValue ( valueBeingUpdated );
							}.bind ( this ),
							this.displayError.bind ( this ),
							null,
							valueBeingUpdated
						);
					}.bind ( this ),
					this.displayError.bind ( this ),
					null,
					reflectedValue
				);
			} else if ( ev.keyCode === 27 /* Esc */ )
				this.valueEditingCancelled ( eVal );
		}.bind ( this ), false );

		eVal.addEventListener ( 'blur', function ( ev : FocusEvent ) {
			var eVal = <HTMLElement> ev.currentTarget;
			this.valueEditingCancelled ( eVal );
		}.bind ( this ), false );

		this.updateValueElement ( eVal, reflectedValue );

		return	eVal;
	}

	private updateTypeElement ( eType : HTMLElement, reflectedType : ReflectedType ) {
		if ( reflectedType != null ) {
			// TODO: display results of Object.isFrozen, Object.isSealed, !Object.isExtensible
			eType.innerText = ' ' + reflectedType.specificType;

			if ( reflectedType.classType !== reflectedType.specificType )
				eType.innerText += '(' + reflectedType.classType + ')';
		} else
			eType.innerText = '';
	}

	private renderType ( reflectedType : any ) {
		var eType = document.createElement ( 'span' );
		eType.className = 'reflected-type';
		this.updateTypeElement ( eType, reflectedType );

		return	eType;
	}

	private renderWatch ( reflectedValue : ReflectedValue, isOpen : boolean, label? : string ) {
		var eWatch = document.createElement ( 'div' );
		eWatch.className = 'watch ' + ( isOpen ? 'watch-open' : 'watch-closed' );
		eWatch ['reflectedValue'] = reflectedValue;
		reflectedValue ['eWatch'] = eWatch;
		reflectedValue ['updateIdx'] = this.updateIdx;
		eWatch ['wasExpanded'] = isOpen;

		var eExp   = eWatch ['eExp']   = this.renderExpander ( reflectedValue ),
			eLabel = eWatch ['eLabel'] = this.renderLabel ( reflectedValue, label ),
			eVal   = eWatch ['eVal']   = this.renderValue ( reflectedValue ),
			eType  = eWatch ['eType']  = this.renderType ( reflectedValue.type ),
			eWatchHeader = eWatch ['eWatchHeader'] = document.createElement ( 'div' );

		eExp ['eWatch'] = eLabel ['eWatch'] = eVal ['eWatch'] =
			eType ['eWatch'] = eWatchHeader ['eWatch'] = eWatch;

		eWatchHeader.className = 'watch-header';
		eWatchHeader.appendChild ( eExp );
		eWatchHeader.appendChild ( eLabel );
		eWatchHeader.appendChild ( eVal );
		eWatchHeader.appendChild ( eType );
		eWatch.appendChild ( eWatchHeader );

		if ( reflectedValue.parentProperty === null ) {	// Root reflected value.
			if ( this._showOnlyLabelForRoot ) {
				WatchWidget.enableClass ( eVal, 'element-collapsed' );
				WatchWidget.enableClass ( eType, 'element-collapsed' );
			}

			eWatchHeader.addEventListener ( 'click',
				this.watchHeaderExpandHandler.bind ( this ), false );

			WatchWidget.enableClass ( eWatchHeader, 'element-clickable' );

			if ( reflectedValue.type !== null &&
				reflectedValue.type.classType === 'Null' ||
				reflectedValue.type.classType === 'Undefined' )
			{
				WatchWidget.enableClass ( eWatch, 'unsubstantial' );
			}
		}

		var eWatchDetails = document.createElement ( 'div' );
		eWatchDetails.className = 'watch-details';
		eWatch.appendChild ( eWatchDetails );
		eWatch ['eWatchDetails'] = eWatchDetails;
		
		return	eWatch;
	}

	/* TODO: make use of this.updateDetails () as it is far more generic. Additionally
	 * it will allow us to avoid duplication of logic. */
	private renderWatchDetails ( eWatch : HTMLElement, reflectedValue : ReflectedValue ) {
		var props = reflectedValue.properties,
			eWatchDetails = <HTMLElement> eWatch ['eWatchDetails'];

		for ( var i = 0 ; i < props.length ; i++ ) {
			var p = props [i],
				pWatch = this.renderWatch ( p.value, false, p.name );
			
			eWatchDetails.appendChild ( pWatch );
		}
	}

	private displayError ( error : any, valueBeingUpdated : ReflectedValue ) {
		this.hideError ();

		if ( error instanceof RequestExecutionError ) {
			var reqExecutionError = <RequestExecutionError> error;

			if ( reqExecutionError.requestType === 'exec-request' ||
				 reqExecutionError.requestType === 'assign-internal-request' )
			{
				error = reqExecutionError.serverMessage;
			}
		}

		var errContainer : HTMLElement;

		if ( valueBeingUpdated )
			errContainer = valueBeingUpdated ['eWatch']['eWatchHeader'];
		else
			errContainer = this._rootElement;

		var eErr = document.createElement ( 'div' );
		eErr.className = 'widget-error';
		eErr.innerText = error + '';
		errContainer.appendChild ( eErr );
		this.errorElement = eErr;
	}

	private hideError () {
		if ( this.errorElement !== null ) {
			this.errorElement.parentElement.removeChild ( this.errorElement );
			this.errorElement = null;
		}
	}
}