var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx } from "react/jsx-runtime";
// import { designTokens } from './styleGuide'; // Can use this later for styling
import { cn } from './utils';
// Define the Button component
export function Button(_a) {
    var { className, children } = _a, props = __rest(_a, ["className", "children"]);
    return (_jsx("button", Object.assign({ className: cn('inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors', 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', 'disabled:pointer-events-none disabled:opacity-50', 
        // Example basic styling (replace/extend with your design system)
        'bg-primary text-primary-foreground shadow hover:bg-primary/90', 'h-9 px-4 py-2', className // Merge with passed className
        ) }, props, { children: children })));
}
