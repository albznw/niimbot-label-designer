import { NiimbotBluetoothClient, NiimbotSerialClient, ImageEncoder } from '@mmote/niimbluelib'
import { bitmapToCanvas } from './label-renderer'

export type ConnectionType = 'bluetooth' | 'serial'

export type PrinterStatus = {
  connected: boolean
  deviceName: string | null
  type: ConnectionType | null
}

export type PrintOptions = {
  density: number
  quantity: number
  labelType?: number
  printHalf?: 'both' | 'top' | 'bottom'
  printDirection?: 'top' | 'left'
}

function rotateCanvas90CCW(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas')
  dst.width = src.height
  dst.height = src.width
  const ctx = dst.getContext('2d')!
  ctx.translate(0, src.width)
  ctx.rotate(-Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  return dst
}

class PrinterClient {
  private bleClient: NiimbotBluetoothClient | null = null
  private serialClient: NiimbotSerialClient | null = null
  private activeType: ConnectionType | null = null
  private deviceName: string | null = null
  private disconnectCallback: (() => void) | null = null

  setDisconnectCallback(cb: () => void) {
    this.disconnectCallback = cb
  }

  getStatus(): PrinterStatus {
    const connected =
      this.activeType === 'bluetooth'
        ? (this.bleClient?.isConnected() ?? false)
        : (this.serialClient?.isConnected() ?? false)
    return {
      connected: this.activeType !== null && connected,
      deviceName: this.deviceName,
      type: this.activeType,
    }
  }

  async connectBluetooth(): Promise<string> {
    if (this.bleClient) {
      await this.bleClient.disconnect().catch(() => undefined)
    }
    this.bleClient = new NiimbotBluetoothClient()
    this.bleClient.on('disconnect', () => {
      this.activeType = null
      this.deviceName = null
      this.disconnectCallback?.()
    })
    const info = await this.bleClient.connect()
    this.activeType = 'bluetooth'
    this.deviceName = info.deviceName ?? 'Bluetooth Printer'
    return this.deviceName
  }

  async connectSerial(): Promise<string> {
    if (this.serialClient) {
      await this.serialClient.disconnect().catch(() => undefined)
    }
    this.serialClient = new NiimbotSerialClient()
    this.serialClient.on('disconnect', () => {
      this.activeType = null
      this.deviceName = null
      this.disconnectCallback?.()
    })
    const info = await this.serialClient.connect()
    this.activeType = 'serial'
    this.deviceName = info.deviceName ?? 'Serial Printer'
    return this.deviceName
  }

  async disconnect(): Promise<void> {
    if (this.activeType === 'bluetooth' && this.bleClient) {
      await this.bleClient.disconnect()
    } else if (this.activeType === 'serial' && this.serialClient) {
      await this.serialClient.disconnect()
    }
    this.activeType = null
    this.deviceName = null
  }

  async print(
    bitmap: Uint8Array,
    bitmapWidth: number,
    bitmapHeight: number,
    options: PrintOptions
  ): Promise<void> {
    const client =
      this.activeType === 'bluetooth' ? this.bleClient : this.serialClient
    if (!client || !client.isConnected()) {
      throw new Error('Printer not connected')
    }

    // Crop bitmap for half-label printing
    let workBitmap = bitmap
    let workWidth = bitmapWidth
    let workHeight = bitmapHeight

    if (options.printHalf === 'top' || options.printHalf === 'bottom') {
      const isHorizontalSplit = (options.printDirection ?? 'top') === 'top'
      if (isHorizontalSplit) {
        const halfH = Math.floor(bitmapHeight / 2)
        const cropped = new Uint8Array(bitmapWidth * halfH)
        const startRow = options.printHalf === 'bottom' ? halfH : 0
        for (let row = 0; row < halfH; row++) {
          const srcStart = (startRow + row) * bitmapWidth
          cropped.set(bitmap.slice(srcStart, srcStart + bitmapWidth), row * bitmapWidth)
        }
        workBitmap = cropped; workWidth = bitmapWidth; workHeight = halfH
      } else {
        const halfW = Math.floor(bitmapWidth / 2)
        const cropped = new Uint8Array(halfW * bitmapHeight)
        const startCol = options.printHalf === 'bottom' ? halfW : 0
        for (let row = 0; row < bitmapHeight; row++) {
          for (let col = 0; col < halfW; col++) {
            cropped[row * halfW + col] = bitmap[row * bitmapWidth + startCol + col]
          }
        }
        workBitmap = cropped; workWidth = halfW; workHeight = bitmapHeight
      }
    }

    let canvas = bitmapToCanvas(workBitmap, workWidth, workHeight)

    // Rotate 90° CCW before encoding when needed.
    // Square originals (double label) must rotate when printing full label (top direction),
    // but NOT when a half-crop has already been applied (crop gives correct dims).
    const originalIsSquare = bitmapWidth === bitmapHeight
    const halfCropApplied = workHeight !== bitmapHeight

    const shouldRotate =
      (workWidth > workHeight && !(originalIsSquare && halfCropApplied)) ||
      (workWidth === workHeight && options.printDirection === 'top')

    if (shouldRotate) {
      canvas = rotateCanvas90CCW(canvas)
    }

    const encoded = ImageEncoder.encodeCanvas(canvas)

    const printTaskOptions: {
      totalPages: number
      density: number
      labelType?: number
    } = {
      totalPages: options.quantity,
      density: options.density,
    }
    if (typeof options.labelType === 'number') {
      printTaskOptions.labelType = options.labelType
    }
    const printTask = client.abstraction.newPrintTask('B1', printTaskOptions)

    await printTask.printInit()
    await printTask.printPage(encoded, options.quantity)
    await printTask.waitForPageFinished()
    await printTask.waitForFinished()
    await client.abstraction.printEnd()
  }
}

export const printerClient = new PrinterClient()
