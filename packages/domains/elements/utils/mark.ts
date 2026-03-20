import Mark from 'mark.js'

export const markApi = {
  create(
    target: ConstructorParameters<typeof Mark>[0],
  ): InstanceType<typeof Mark> {
    return new Mark(target)
  },
}
