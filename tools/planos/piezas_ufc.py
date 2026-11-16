"""Piezas del DIAGRAMA UNIFILAR DEL TABLERO DE CONTROL (plano de referencia del usuario, DI-002).
Coordenadas del espacio modelo de la referencia (mm). Barras: principal 120 Vac y = 516.67, 24 Vdc y = 405.03,
distribución 120 Vac y = 414.07, servicios 220 Vac y = 414.34, tierra y = 338.70. Columnas: 24 Vdc cada 20 mm
(x = 34.34 + 20k), 120 Vac cada 23 mm (x = 246.92 + 23k), 220 Vac cada 25.71 mm (x = 561.97 + 25.71k).
Los textos de cable y descripción de las columnas los escribe el generador (en la referencia se superponen)."""
Y0, Y24, Y120, Y220, YT = 516.67, 405.03, 414.07, 414.34, 338.70
X = lambda x: x
FIJO_COL = {'2C#14AWG+14AWG(T) 0.6/1kV': '', '2C#16AWG+16AWG(T) 0.6/1kV': ''}

PIEZAS_KIT = {
    'fuente': 'Diagrama unifilar del tablero de control (referencia del usuario)',
    'piezas': {
        # acometida estabilizada (120 Vac): recuadro de procedencia, MCB1 y cable hasta la barra principal
        'acom120': dict(rects=[(95, 655, 240, 700), (128, 517.2, 175, 662)], centro=True, ancla=(145.87, Y0), textos={
            're:^VIENE DEL TABLERO DE DISTRIBUCI': '{acometida}',
            'MCB1': '{q}', '2X16A': '{qv}', '2C#12AWG+12AWG(T) 0.6/1kV': '{cable}'}),
        # acometida auxiliar (220 Vac) desde el tablero de fuerza: MCB2, CB20 y supresores con su retorno a tierra
        'acom220': dict(rects=[(520, 655, 650, 700), (540, 414.6, 650, 662), (615, 402.5, 616.5, 403.5)], centro=True, ancla=(561.97, Y220), textos={
            're:^TABLERO DE FUERZA .*2x220': '{acometida}',
            'MCB2': '{q}', '2X10A': '{qv}', 'CB20': '{qs}', '2X20A': '{qsv}', 'SPD3,SPD4': '{spd}', 'TIPO 2': '{spdt}', 'OVR T2 40-275S P QS': '{spdm}',
            '2C#12AWG+12AWG(T) 0.6/1kV': '{cable}', 'R,S 220 VAC, 1F, 60Hz, 10 KA': ''}),
        # derivación de la fuente de 24 Vdc (CB1 → PS1 → CB2) desde la barra principal hasta la barra de 24 Vdc
        'fuente': dict(rects=[(60, 405.6, 105, 516.2)], centro=True, max_ancho=30, ancla=(74.34, Y0), textos={
            'C1': '{circ}', 'CB1': '{q}', '2X10A': '{qv}', 'PS1': '{ps}', '10A': '{psa}', '24VDC': '{psv}', 'CB2': '{q2}', '2X6A': '{q2v}'}),
        # derivación de la distribución de 120 Vac (CB3)
        'cb3': dict(rects=[(325, 414.6, 360, 516.2)], centro=True, max_ancho=30, ancla=(338.92, Y0), textos={'C2': '{circ}', 'CB3': '{q}', '2X10A': '{qv}'}),
        # columnas (ancla: eje del circuito sobre su barra)
        'col24': dict(rects=[(44.4, 245, 64.3, 410)], centro=True, max_ancho=15, ancla=(54.34, Y24), textos=dict(FIJO_COL, **{
            'C2': '{circ}', 'F2': '{f}', '1A': '{fv}', 'ALIMENTACIÓN A LAS ENTRADAS ANALÓGICAS': ''})),
        'col24_res': dict(rects=[(184.4, 245, 204.3, 410)], centro=True, max_ancho=15, ancla=(194.34, Y24), textos=dict(FIJO_COL, **{
            'C9': '{circ}', 'F9': '{f}', '1A': '{fv}', 'RESERVA': ''})),
        'col120': dict(rects=[(258.5, 245, 281.4, 420)], centro=True, max_ancho=15, ancla=(269.92, Y120), textos=dict(FIJO_COL, **{
            'C2': '{circ}', 'CB5': '{q}', '2X2A': '{qv}', 'ALIMENTACIÓN SALIDAS DIGITALES': '', 'ALIMENTACIÓN A SALIDAS DIGITALES': ''})),
        'col120_res': dict(rects=[(488.5, 245, 511.4, 420)], centro=True, max_ancho=15, ancla=(499.92, Y120), textos=dict(FIJO_COL, **{
            'C12': '{circ}', 'CB15': '{q}', '2X2A': '{qv}', 'RESERVA': ''})),
        'col220': dict(rects=[(549.2, 245, 574.8, 420)], centro=True, max_ancho=15, ancla=(561.97, Y220), textos=dict(FIJO_COL, **{
            'C1': '{circ}', 'CB17': '{q}', '2X4A': '{qv}', 'VENTILACIÓN': ''})),
        'col220_id': dict(rects=[(600.6, 245, 626.2, 420)], centro=True, max_ancho=15, ancla=(613.39, Y220), textos=dict(FIJO_COL, **{
            'C3': '{circ}', 'CB19': '{q}', '2X4A': '{qv}', 'ID1 2A 30mA': '{id}', 'ALIMENTACIÓN AL TOMACORRIENTE': ''})),
        # puesta a tierra, título y leyenda
        'tierra': dict(rects=[(0, 160, 26, 337.5)], centro=True, ancla=(16.94, YT), textos={'POZO A TIERRA': 'POZO A\nTIERRA', '2C#14AWG+14AWG(T) 0.6/1kV': ''}),
        'titulo': dict(rects=[(5, 615, 130, 640)], ancla=(10.8, 631.8), centrar=dict(cajas=[(10.8, 621.0, 120.9, 631.8)]), textos={
            're:^TABLERO DE CONTROL .*1F\\+N\\+T': '{tit1}\n{tit2}'}),
        'leyenda': dict(rects=[(652, 418, 806, 556)], ancla=(660.58, 549.79), centrar=dict(celdas=True), textos={'POSO A TIERRA': 'POZO A TIERRA', '(NOTA 3)': ''}),
    },
}
