import {
  requireRouterEntryModule,
  withRouteIds,
  type RouterEntryModule,
} from '../src/router-contract'

const RouteRenderer = (() => null) as RouterEntryModule['RouteRenderer']
const matchRouteBranchWithParams = () => []
const resolveRouteBranch = async () => []

describe('router entry contract', () => {
  it('preserves the router functions supplied by the SSR entry', () => {
    const entry: RouterEntryModule = {
      RouteRenderer,
      matchRouteBranchWithParams,
      resolveRouteBranch,
    }

    const resolved = requireRouterEntryModule(entry)

    expect(resolved.RouteRenderer).toBe(RouteRenderer)
    expect(resolved.matchRouteBranchWithParams).toBe(matchRouteBranchWithParams)
    expect(resolved.resolveRouteBranch).toBe(resolveRouteBranch)
  })

  it('assigns stable hierarchical ids while preserving explicit ids', () => {
    const routes = withRouteIds([
      {
        path: 'docs',
        children: [{ path: 'intro' }, { id: 'custom', path: 'api' }],
      },
    ])

    expect(routes[0].id).toBe('0')
    expect(routes[0].children?.[0].id).toBe('0-0')
    expect(routes[0].children?.[1].id).toBe('custom')
  })

  it('rejects an entry without the complete SSR contract', () => {
    expect(() => requireRouterEntryModule({ RouteRenderer })).toThrow(
      'The SSR entry must expose RouteRenderer, matchRouteBranchWithParams, and resolveRouteBranch',
    )
  })
})
