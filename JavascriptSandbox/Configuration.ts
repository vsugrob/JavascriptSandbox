/// <reference path="System.ts" />

class Configuration {
	/** This constant affects entire project:
	  * most oftenly it is used in checks similiar to
	  * conditional compilation directives in languages
	  * with preprocessor support. */
	public static DEBUG = true;

	public static freezeSetting ( o : any, p : string, defaultValue : any ) {
		var value = o [p];
		
		if ( value == null )
			value = defaultValue;
		
		System.makeConst ( o, p, value );
	}
}

Configuration.freezeSetting ( Configuration, 'DEBUG', false );