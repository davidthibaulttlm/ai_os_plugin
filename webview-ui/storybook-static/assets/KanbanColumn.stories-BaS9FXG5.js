import{j as m}from"./jsx-runtime-B_sIsjMO.js";import{D as a}from"./IssueCard-kxdV3qU9.js";import{K as n}from"./KanbanColumn-DvfjiGFK.js";import"./iframe-DjCpRxqI.js";import"./preload-helper-CmsKOCeN.js";import"./index-QA9hwFIQ.js";const C={title:"Components/KanbanColumn",component:n,tags:["autodocs"],decorators:[o=>m.jsx(a,{children:m.jsx(o,{})})]},p={id:"brain_dump",name:"BRAIN_DUMP",color:"#6b7280"},i={id:"ai_spec",name:"AI_SPEC",color:"#3b82f6"},u={id:"pr_done",name:"PR_DONE",color:"#22c55e"},s={args:{column:p,items:[]}},c=[{id:"issue_1",type:"ISSUE",title:"Implement user authentication",number:42,status:"AI_SPEC",url:"https://github.com/example/repo/issues/42",repo:"example/repo",priority:"high",labels:["feature","auth"]},{id:"issue_2",type:"ISSUE",title:"Add API rate limiting",number:43,status:"AI_SPEC",url:"https://github.com/example/repo/issues/43",repo:"example/repo",priority:"medium",labels:["backend"]}],t={args:{column:i,items:c}},l=Array.from({length:10},(o,e)=>({id:`done_${e}`,type:"ISSUE",title:`Completed feature ${e+1}`,number:100+e,status:"PR_DONE",url:`https://github.com/example/repo/issues/${100+e}`,repo:"example/repo"})),r={args:{column:u,items:l}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    column: brainDumpColumn,
    items: []
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    column: aiSpecColumn,
    items: sampleItems
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    column: prDoneColumn,
    items: manyItems
  }
}`,...r.parameters?.docs?.source}}};const S=["Empty","WithItems","ManyItems"];export{s as Empty,r as ManyItems,t as WithItems,S as __namedExportsOrder,C as default};
