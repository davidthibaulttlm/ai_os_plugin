import{j as e}from"./jsx-runtime-DC_2WrdX.js";import"./iframe-BfQM_Kyp.js";import"./preload-helper-CmsKOCeN.js";function n({onRefresh:a,agentBusy:t=!1}){return e.jsxs("header",{className:"flex items-center justify-between px-4 py-2 bg-vscode-panel-background border-b border-vscode-panel-border",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("h1",{className:"text-lg font-bold text-vscode-panel-foreground",children:"AI OS Kanban"}),t&&e.jsxs("span",{className:"flex items-center gap-1 text-xs bg-vscode-badge-background text-vscode-badge-foreground px-2 py-0.5 rounded",children:[e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-vscode-progressBar-background animate-pulse"}),"Agent Working"]})]}),e.jsx("button",{onClick:a,className:"px-3 py-1.5 text-sm bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded-md transition-colors",children:"Refresh"})]})}n.__docgenInfo={description:"",methods:[],displayName:"Header",props:{onRefresh:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},agentBusy:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}}}};const{fn:o}=__STORYBOOK_MODULE_TEST__,p={title:"Components/Header",component:n,tags:["autodocs"]},s={args:{onRefresh:o()}},r={args:{onRefresh:o(),agentBusy:!0}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    onRefresh: fn()
  }
}`,...s.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    onRefresh: fn(),
    agentBusy: true
  }
}`,...r.parameters?.docs?.source}}};const i=["Default","AgentBusy"];export{r as AgentBusy,s as Default,i as __namedExportsOrder,p as default};
