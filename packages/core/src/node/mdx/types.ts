export interface MdxJsxAttributeValueExpression {
  type: 'mdxJsxAttributeValueExpression'
  value: string
  data?: {
    estree?: any
  }
}

export interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value?: string | MdxJsxAttributeValueExpression
}

export interface MdxJsxElement {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string | null
  attributes?: MdxJsxAttribute[]
  children?: any[]
}

export interface ElementNode {
  type: 'element'
  tagName: string
  properties?: Record<string, any>
  children?: any[]
}

export interface TextNode {
  type: 'text'
  value: string
}

export interface CodeNode {
  type: 'code'
  lang?: string
  meta?: string
  value: string
  data?: {
    hProperties?: Record<string, any>
    [key: string]: any
  }
}
