"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[633],{7404:function(e,n,t){t.d(n,{j:function(){return o}});let r=e=>"boolean"==typeof e?"".concat(e):0===e?"0":e,u=function(){for(var e=arguments.length,n=Array(e),t=0;t<e;t++)n[t]=arguments[t];return n.flat(1/0).filter(Boolean).join(" ")},o=(e,n)=>t=>{var o;if((null==n?void 0:n.variants)==null)return u(e,null==t?void 0:t.class,null==t?void 0:t.className);let{variants:l,defaultVariants:i}=n,c=Object.keys(l).map(e=>{let n=null==t?void 0:t[e],u=null==i?void 0:i[e];if(null===n)return null;let o=r(n)||r(u);return l[e][o]}),a=t&&Object.entries(t).reduce((e,n)=>{let[t,r]=n;return void 0===r||(e[t]=r),e},{}),s=null==n?void 0:null===(o=n.compoundVariants)||void 0===o?void 0:o.reduce((e,n)=>{let{class:t,className:r,...u}=n;return Object.entries(u).every(e=>{let[n,t]=e;return Array.isArray(t)?t.includes({...i,...a}[n]):({...i,...a})[n]===t})?[...e,t,r]:e},[]);return u(e,c,s,null==t?void 0:t.class,null==t?void 0:t.className)}},85744:function(e,n,t){t.d(n,{M:function(){return r}});function r(e,n,{checkForDefaultPrevented:t=!0}={}){return function(r){if(null==e||e(r),!1===t||!r.defaultPrevented)return null==n?void 0:n(r)}}},56989:function(e,n,t){t.d(n,{b:function(){return o},k:function(){return u}});var r=t(2265);function u(e,n){let t=(0,r.createContext)(n);function u(e){let{children:n,...u}=e,o=(0,r.useMemo)(()=>u,Object.values(u));return(0,r.createElement)(t.Provider,{value:o},n)}return u.displayName=e+"Provider",[u,function(u){let o=(0,r.useContext)(t);if(o)return o;if(void 0!==n)return n;throw Error(`\`${u}\` must be used within \`${e}\``)}]}function o(e,n=[]){let t=[],u=()=>{let n=t.map(e=>(0,r.createContext)(e));return function(t){let u=(null==t?void 0:t[e])||n;return(0,r.useMemo)(()=>({[`__scope${e}`]:{...t,[e]:u}}),[t,u])}};return u.scopeName=e,[function(n,u){let o=(0,r.createContext)(u),l=t.length;function i(n){let{scope:t,children:u,...i}=n,c=(null==t?void 0:t[e][l])||o,a=(0,r.useMemo)(()=>i,Object.values(i));return(0,r.createElement)(c.Provider,{value:a},u)}return t=[...t,u],i.displayName=n+"Provider",[i,function(t,i){let c=(null==i?void 0:i[e][l])||o,a=(0,r.useContext)(c);if(a)return a;if(void 0!==u)return u;throw Error(`\`${t}\` must be used within \`${n}\``)}]},function(...e){let n=e[0];if(1===e.length)return n;let t=()=>{let t=e.map(e=>({useScope:e(),scopeName:e.scopeName}));return function(e){let u=t.reduce((n,{useScope:t,scopeName:r})=>{let u=t(e),o=u[`__scope${r}`];return{...n,...o}},{});return(0,r.useMemo)(()=>({[`__scope${n.scopeName}`]:u}),[u])}};return t.scopeName=n.scopeName,t}(u,...n)]}},20966:function(e,n,t){t.d(n,{M:function(){return c}});var r,u=t(2265),o=t(51030);let l=(r||(r=t.t(u,2)))["useId".toString()]||(()=>void 0),i=0;function c(e){let[n,t]=u.useState(l());return(0,o.b)(()=>{e||t(e=>null!=e?e:String(i++))},[e]),e||(n?`radix-${n}`:"")}},36743:function(e,n,t){t.d(n,{f:function(){return i}});var r=t(13428),u=t(2265),o=t(9381);let l=(0,u.forwardRef)((e,n)=>(0,u.createElement)(o.WV.label,(0,r.Z)({},e,{ref:n,onMouseDown:n=>{var t;null===(t=e.onMouseDown)||void 0===t||t.call(e,n),!n.defaultPrevented&&n.detail>1&&n.preventDefault()}}))),i=l},85606:function(e,n,t){t.d(n,{z:function(){return i}});var r=t(2265),u=t(54887),o=t(42210),l=t(51030);let i=e=>{let{present:n,children:t}=e,i=function(e){var n;let[t,o]=(0,r.useState)(),i=(0,r.useRef)({}),a=(0,r.useRef)(e),s=(0,r.useRef)("none"),d=e?"mounted":"unmounted",[f,v]=(n={mounted:{UNMOUNT:"unmounted",ANIMATION_OUT:"unmountSuspended"},unmountSuspended:{MOUNT:"mounted",ANIMATION_END:"unmounted"},unmounted:{MOUNT:"mounted"}},(0,r.useReducer)((e,t)=>{let r=n[e][t];return null!=r?r:e},d));return(0,r.useEffect)(()=>{let e=c(i.current);s.current="mounted"===f?e:"none"},[f]),(0,l.b)(()=>{let n=i.current,t=a.current,r=t!==e;if(r){let r=s.current,u=c(n);e?v("MOUNT"):"none"===u||(null==n?void 0:n.display)==="none"?v("UNMOUNT"):t&&r!==u?v("ANIMATION_OUT"):v("UNMOUNT"),a.current=e}},[e,v]),(0,l.b)(()=>{if(t){let e=e=>{let n=c(i.current),r=n.includes(e.animationName);e.target===t&&r&&(0,u.flushSync)(()=>v("ANIMATION_END"))},n=e=>{e.target===t&&(s.current=c(i.current))};return t.addEventListener("animationstart",n),t.addEventListener("animationcancel",e),t.addEventListener("animationend",e),()=>{t.removeEventListener("animationstart",n),t.removeEventListener("animationcancel",e),t.removeEventListener("animationend",e)}}v("ANIMATION_END")},[t,v]),{isPresent:["mounted","unmountSuspended"].includes(f),ref:(0,r.useCallback)(e=>{e&&(i.current=getComputedStyle(e)),o(e)},[])}}(n),a="function"==typeof t?t({present:i.isPresent}):r.Children.only(t),s=(0,o.e)(i.ref,a.ref),d="function"==typeof t;return d||i.isPresent?(0,r.cloneElement)(a,{ref:s}):null};function c(e){return(null==e?void 0:e.animationName)||"none"}i.displayName="Presence"},16459:function(e,n,t){t.d(n,{W:function(){return u}});var r=t(2265);function u(e){let n=(0,r.useRef)(e);return(0,r.useEffect)(()=>{n.current=e}),(0,r.useMemo)(()=>(...e)=>{var t;return null===(t=n.current)||void 0===t?void 0:t.call(n,...e)},[])}},73763:function(e,n,t){t.d(n,{T:function(){return o}});var r=t(2265),u=t(16459);function o({prop:e,defaultProp:n,onChange:t=()=>{}}){let[o,l]=function({defaultProp:e,onChange:n}){let t=(0,r.useState)(e),[o]=t,l=(0,r.useRef)(o),i=(0,u.W)(n);return(0,r.useEffect)(()=>{l.current!==o&&(i(o),l.current=o)},[o,l,i]),t}({defaultProp:n,onChange:t}),i=void 0!==e,c=i?e:o,a=(0,u.W)(t),s=(0,r.useCallback)(n=>{if(i){let t="function"==typeof n?n(e):n;t!==e&&a(t)}else l(n)},[i,e,l,a]);return[c,s]}},12488:function(e,n,t){t.d(n,{e:function(){return o}});var r=t(2265),u=t(16459);function o(e,n=null==globalThis?void 0:globalThis.document){let t=(0,u.W)(e);(0,r.useEffect)(()=>{let e=e=>{"Escape"===e.key&&t(e)};return n.addEventListener("keydown",e),()=>n.removeEventListener("keydown",e)},[t,n])}},51030:function(e,n,t){t.d(n,{b:function(){return u}});var r=t(2265);let u=(null==globalThis?void 0:globalThis.document)?r.useLayoutEffect:()=>{}}}]);