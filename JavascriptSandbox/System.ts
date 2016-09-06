'use strict';

class System {
	public static builtin = {
		create : Object.create,
		defineProperty : Object.defineProperty,
		freeze : Object.freeze,
		getOwnPropertyDescriptor : Object.getOwnPropertyDescriptor,
		getOwnPropertyNames : Object.getOwnPropertyNames,
	};

	public static breakPrototypeChain ( ctor : Function ) {
		var pOld = ctor.prototype,
			pNew = System.builtin.create ( null ),
			keys = System.builtin.getOwnPropertyNames ( pOld );

		for ( var i = 0 ; i < keys.length ; i++ ) {
			var key = keys [i],
				pd = System.builtin.getOwnPropertyDescriptor ( pOld, key );

			System.builtin.defineProperty ( pNew, key, pd );
		}

		pNew.constructor = ctor;
		ctor.prototype = pNew;
	}

	public static assert ( condition : bool, message? : string ) {
		if ( !condition )
			throw new Error ( message );
	}
	
	/* TODO: make this method generic toFrozenMap <T> ( keyValueMap : T ) : T
	 * when stable (and fast) version of 0.9.x compiler released. */
	public static toFrozenMap ( keyValueMap : any ) {
		var map = System.builtin.create ( null ),
			keys = System.builtin.getOwnPropertyNames ( keyValueMap );

		for ( var i = 0 ; i < keys.length ; i++ ) {
			var key = keys [i],
				value = keyValueMap [key];

			if ( value != null && typeof value === 'object' )
				value = System.builtin.freeze ( value );

			map [key] = value;
		}

		return	System.builtin.freeze ( map );
	}

	public static makeConst ( o : any, p : string, value? : any ) {
		var attrs = System.builtin.create ( null );
		attrs.configurable = false;
		attrs.writable = false;

		if ( value !== undefined )
			attrs.value = value;

		System.builtin.defineProperty ( o, p, attrs );
	}
}

System.builtin = System.builtin.freeze ( System.builtin );