import{j as s}from"./jsx-runtime-B_sIsjMO.js";import{I as a,D as n,S as m,v as p}from"./IssueCard-kxdV3qU9.js";import"./iframe-DjCpRxqI.js";import"./preload-helper-CmsKOCeN.js";import"./index-QA9hwFIQ.js";const b={title:"Components/IssueCard",component:a,tags:["autodocs"],decorators:[o=>s.jsx(n,{children:s.jsx(m,{items:["item_1"],strategy:p,children:s.jsx(o,{})})})]},i={id:"item_1",type:"ISSUE",title:"Implement user authentication",number:42,status:"AI_SPEC",url:"https://github.com/example/repo/issues/42",repo:"example/repo",priority:"high",labels:["feature","auth"]},e={args:{item:i}},t={args:{item:{...i,id:"pr_1",type:"PULL_REQUEST",title:"Fix login redirect bug",number:15,status:"HUMAN_CODE_REVIEW",url:"https://github.com/example/repo/pull/15",priority:"critical",labels:["bugfix"]}}},r={args:{item:{...i,id:"item_2",title:"Add dark mode support",number:99,status:"BRAIN_DUMP",url:"https://github.com/example/repo/issues/99",priority:void 0}}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    item: baseItem
  }
}`,...e.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    item: {
      ...baseItem,
      id: 'pr_1',
      type: 'PULL_REQUEST',
      title: 'Fix login redirect bug',
      number: 15,
      status: 'HUMAN_CODE_REVIEW',
      url: 'https://github.com/example/repo/pull/15',
      priority: 'critical',
      labels: ['bugfix']
    }
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    item: {
      ...baseItem,
      id: 'item_2',
      title: 'Add dark mode support',
      number: 99,
      status: 'BRAIN_DUMP',
      url: 'https://github.com/example/repo/issues/99',
      priority: undefined
    }
  }
}`,...r.parameters?.docs?.source}}};const x=["Issue","PullRequest","NoPriority"];export{e as Issue,r as NoPriority,t as PullRequest,x as __namedExportsOrder,b as default};
