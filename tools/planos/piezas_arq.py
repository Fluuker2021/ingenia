"""Piezas de la ARQUITECTURA DE CONTROL (plano de referencia del usuario, BJ-001): imágenes de los equipos del
tablero (switch, router IIoT, pantalla HMI, PLC, variador, controlador de limpieza) y de los instrumentos de campo
(transmisores, sensores, interruptores de nivel y de velocidad, válvulas solenoides), y la leyenda de cables.
Las imágenes se simplifican (encadenado de segmentos + Douglas-Peucker) para que el kit sea liviano.
Anclas: equipos del tablero en el centro de su imagen; instrumentos en el eje de su conexión, arriba de la imagen."""
S = dict(simplificar=True)
CABLES = ['I-SE-ANALO', 'I-CONTROL', 'I-DAT', 'I-FO']
eq = lambda r, ancla, **k: dict(rects=[r], ancla=ancla, capas=['I-EQ', 'I-SIM'], **S, **k)

PIEZAS_KIT = {
    'fuente': 'Arquitectura de control (referencia del usuario)',
    'piezas': {
        'sw': eq((96, 577, 119, 629), (107.5, 602.9)),
        'router': eq((85, 527.5, 112, 553.5), (98.65, 540.45)),
        'hmi': eq((123, 527.5, 157.5, 556), (140.2, 541.7)),
        'plc': eq((201.5, 525, 278.5, 565.5), (239.85, 545.1), textos={**{f'SLOT {i}': '' for i in range(10)}, **{k: '' for k in ('AI1', 'AI2', 'AO1', 'DO1', 'DO2', 'DI1', 'DI2')}}),
        'vfd': eq((301, 527.5, 334.5, 577), (317.65, 552.35)),
        'limpieza': eq((140.5, 486.5, 173, 512.5), (156.8, 499.4)),
        # instrumentos de campo (ancla: eje de la conexión, sobre la imagen)
        'img_pit': eq((103.5, 366, 141, 400.5), (128.58, 399.1)),
        'img_vt': eq((208, 366, 217, 386.5), (212.35, 385.6)),
        'img_at': eq((250, 366, 273.5, 410), (254.4, 408.9)),
        'img_lsh': eq((272, 366, 309, 414), (296.8, 412.8)),
        'img_ssl': eq((412.5, 366, 433, 398.5), (422.61, 397.5)),
        'img_ss': eq((544.5, 366, 553.5, 381.5), (548.77, 380.5)),
        'img_xv': eq((114.5, 270, 136.5, 300), (128.58, 298.9)),
        'leyenda': dict(rects=[(676, 556, 812, 650)], ancla=(733.79, 636.98), textos={'CABLE DE CONTROL (120 VAC)': 'CABLE DE CONTROL\n({vctrl})'}),
    },
}
