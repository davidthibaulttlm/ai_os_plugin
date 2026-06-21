import{j as e}from"./jsx-runtime-DC_2WrdX.js";import{d as i,S as l,v as u,I as o}from"./IssueCard-B4Y41-F-.js";function d({column:s,items:n}){const{setNodeRef:t,isOver:a}=i({id:s.id});return e.jsxs("div",{ref:t,className:`flex flex-col min-w-[280px] max-w-[280px] h-full bg-vscode-sideBar-background rounded-lg p-3 transition-colors ${a?"ring-2 ring-vscode-focusBorder bg-vscode-list-hoverBackground":""}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-3",children:[e.jsx("h3",{className:"font-semibold text-sm text-vscode-sideBar-foreground",children:s.name.replace(/_/g," ")}),e.jsx("span",{className:"text-xs text-vscode-descriptionForeground",children:n.length})]}),e.jsx("div",{className:"flex-1 overflow-y-auto min-h-[100px]",children:e.jsx(l,{items:n.map(r=>r.id),strategy:u,children:e.jsx("div",{className:"flex flex-col gap-2",children:n.map(r=>e.jsx(o,{item:r},r.id))})})})]})}d.__docgenInfo={description:"",methods:[],displayName:"KanbanColumn",props:{column:{required:!0,tsType:{name:"KanbanColumn"},description:""},items:{required:!0,tsType:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST';
  title: string;
  number: number;
  status: string;
  url: string;
  repo: string;
  priority?: string;
  labels?: string[];
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"type",value:{name:"union",raw:"'ISSUE' | 'PULL_REQUEST'",elements:[{name:"literal",value:"'ISSUE'"},{name:"literal",value:"'PULL_REQUEST'"}],required:!0}},{key:"title",value:{name:"string",required:!0}},{key:"number",value:{name:"number",required:!0}},{key:"status",value:{name:"string",required:!0}},{key:"url",value:{name:"string",required:!0}},{key:"repo",value:{name:"string",required:!0}},{key:"priority",value:{name:"string",required:!1}},{key:"labels",value:{name:"Array",elements:[{name:"string"}],raw:"string[]",required:!1}}]}}],raw:"IssueItem[]"},description:""}}};export{d as K};
