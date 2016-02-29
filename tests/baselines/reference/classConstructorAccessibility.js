//// [classConstructorAccessibility.ts]

class C {
    public constructor(public x: number) { }
}

class D {
    private constructor(public x: number) { }
}

class E {
    protected constructor(public x: number) { }
}

var c = new C(1);
var d = new D(1); // error
var e = new E(1); // error

module Generic {
    class C<T> {
        public constructor(public x: T) { }
    }

    class D<T> {
        private constructor(public x: T) { }
    }

    class E<T> {
        protected constructor(public x: T) { }
    }

    var c = new C(1);
    var d = new D(1); // error
    var e = new E(1); // error
}


//// [classConstructorAccessibility.js]
var C = (function () {
    function C(x) {
        this.x = x;
    }
    return C;
}());
var D = (function () {
    function D(x) {
        this.x = x;
    }
    return D;
}());
var E = (function () {
    function E(x) {
        this.x = x;
    }
    return E;
}());
var c = new C(1);
var d = new D(1); // error
var e = new E(1); // error
var Generic;
(function (Generic) {
    var C = (function () {
        function C(x) {
            this.x = x;
        }
        return C;
    }());
    var D = (function () {
        function D(x) {
            this.x = x;
        }
        return D;
    }());
    var E = (function () {
        function E(x) {
            this.x = x;
        }
        return E;
    }());
    var c = new C(1);
    var d = new D(1); // error
    var e = new E(1); // error
})(Generic || (Generic = {}));


//// [classConstructorAccessibility.d.ts]
declare class C {
    x: number;
    constructor(x: number);
}
declare class D {
    x: number;
    private constructor(x);
}
declare class E {
    x: number;
    protected constructor(x: number);
}
declare var c: C;
declare var d: D;
declare var e: E;
declare module Generic {
}
