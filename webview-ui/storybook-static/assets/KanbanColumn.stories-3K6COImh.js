import{j as a}from"./jsx-runtime-DC_2WrdX.js";import{D as p}from"./IssueCard-B4Y41-F-.js";import{K as n}from"./KanbanColumn-BeYpum24.js";import"./iframe-BfQM_Kyp.js";import"./preload-helper-CmsKOCeN.js";import"./index-DmtX3LOG.js";const x={title:"Components/KanbanColumn",component:n,tags:["autodocs"],decorators:[m=>a.jsx(p,{children:a.jsx(m,{})})]},u={id:"brain_dump",name:"BRAIN_DUMP",color:"#6b7280"},i={id:"ai_spec",name:"AI_SPEC",color:"#3b82f6"},l={id:"pr_done",name:"PR_DONE",color:"#22c55e"},r={args:{column:u,items:[]}},c=[{id:"issue_1",type:"ISSUE",title:"Implement user authentication",number:42,status:"AI_SPEC",url:"https://github.com/example/repo/issues/42",repo:"example/repo",priority:"high",labels:["feature","auth"]},{id:"issue_2",type:"ISSUE",title:"Add API rate limiting",number:43,status:"AI_SPEC",url:"https://github.com/example/repo/issues/43",repo:"example/repo",priority:"medium",labels:["backend"]}],t={args:{column:i,items:c}},d=Array.from({length:10},(m,e)=>({id:`done_${e}`,type:"ISSUE",title:`Completed feature ${e+1}`,number:100+e,status:"PR_DONE",url:`https://github.com/example/repo/issues/${100+e}`,repo:"example/repo"})),s={args:{column:l,items:d}},y=[{id:"priority_1",type:"ISSUE",title:"Critical bug - highest priority",number:301,status:"AI_CODE",url:"https://github.com/example/repo/issues/301",repo:"example/repo",priority:"critical",labels:["bug"]},{id:"priority_2",type:"ISSUE",title:"High priority feature",number:302,status:"AI_CODE",url:"https://github.com/example/repo/issues/302",repo:"example/repo",priority:"high",labels:["feature"]},{id:"priority_3",type:"ISSUE",title:"Medium priority task",number:303,status:"AI_CODE",url:"https://github.com/example/repo/issues/303",repo:"example/repo",priority:"medium",labels:[]}],o={args:{column:i,items:y}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    column: brainDumpColumn,
    items: []
  }
}`,...r.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    column: aiSpecColumn,
    items: sampleItems
  }
}`,...t.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    column: prDoneColumn,
    items: manyItems
  }
}`,...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    column: aiSpecColumn,
    items: priorityOrderedItems
  }
}`,...o.parameters?.docs?.source}}};const C=["Empty","WithItems","ManyItems","PriorityOrder"];export{r as Empty,s as ManyItems,o as PriorityOrder,t as WithItems,C as __namedExportsOrder,x as default};
