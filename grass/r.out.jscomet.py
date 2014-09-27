#!/usr/bin/env python
#
############################################################################
#
# MODULE:       r.out.jscomet
# AUTHOR(S):    Vaclav Petras
# PURPOSE:      Outputs raster map as JavaScript two dimensional array
#               suitable for comet-like visualization
#
# COPYRIGHT:    (C) 2014 by Vaclav Petras and the GRASS Development Team
#
#               This program is free software under the GNU General Public
#               License (>=v2). Read the file COPYING that comes with GRASS
#               for details.
#
#############################################################################


#%module
#% description: Outputs raster map as JavaScript two dimensional array
#% keywords: raster
#% keywords: export
#% keywords: visualization
#% keywords: web
#% keywords: comet
#%end
#%option G_OPT_R_INPUT
#% key: direction
#% label: Name(s) of input raster map(s)
#% description: Either this or strds option must be used to specify the input.
#% multiple: no
#% required: yes
#%end
#%option G_OPT_R_INPUT
#% key: probability
#% label: Name(s) of input raster map(s)
#% description: Either this or strds option must be used to specify the input.
#% multiple: no
#% required: no
#%end
#%option G_OPT_R_INPUT
#% key: magnitude
#% label: Name(s) of input raster map(s)
#% description: Either this or strds option must be used to specify the input.
#% multiple: no
#% required: yes
#%end
#%option G_OPT_F_OUTPUT
#% multiple: no
#% required: yes
#%end
#%option
#% key: scale
#% type: double
#% label: Years
#% description: Must be same count of rasters
#% multiple: no
#% required: no
#% answer: 1
#%end


# -*- coding: utf-8 -*-
"""
Created on Sat Mar 29 18:29:03 2014

@author: Vaclav Petras, <wenzeslaus gmail com>
"""

# r.recode -d --overwrite input=landcover_1m@PERMANENT output=probability rules=/home/vasek/grassdata/nc_spm_08_grass7/PERMANENT/.tmp/vubu32/20122.1
# 1:1:1
# 2:2:0.1
# 3:3:1
# 4:4:1
# 5:5:1
# 6:6:1
# 7:7:1
# 8:8:1
# 9:9:1
# 10:10:1
# 11:11:0.1

# python ./r.out.js.py --help > columns_asp.js

import math
import numpy
import grass.script.core as gcore
from grass.pygrass.raster import RasterRow
#
#with RasterRow('aspect') as elev:
#    for row in elev:
#        l = []
#        for cell in row:
#            l.append(str(cell))
#        print ' '.join(l)

options, flags = gcore.parser()

direction = options['direction']
magnitude = options['magnitude']
probability = options['magnitude']
scale = float(options['scale'])

direction = RasterRow(direction)
speed = RasterRow(magnitude)

direction.open()
speed.open()

rows = []
for i, dir_row in enumerate(direction):
    speed_row = speed[i]
    vectors = []
    for j, dir_cell in enumerate(dir_row):
        speed_cell = speed_row[j]
        if speed_cell < 0:
            speed_cell = 0
        dx = numpy.cos(dir_cell / 180. * math.pi) * speed_cell * scale
        dy = - numpy.sin(dir_cell / 180. * math.pi) * speed_cell * scale
        m = speed_cell * scale
        #dx = 5;
        #dy = 0;
        vectors.append('[' + ','.join([str(dx), str(dy), str(m)]) + ']')

    #rows.append('[' + ','.join(vectors) + ']\n')
    rows.append(vectors)

#print 'columns = ' + '[' + ','.join(rows) + ']'

ncols = len(rows[0])

columns = []
for i in range(ncols):
    column = []
    for row in rows:
        column.append(row[i])
    columns.append('[' + ','.join(column) + ']\n')

print 'columns = ' + '[' + ','.join(columns) + ']'

if probability:
    probability = RasterRow(probability)

    probability.open()

    rows = []
    for prob_row in probability:
	row = []
	for prob_cell in prob_row:
	    row.append(str(prob_cell))
	rows.append(row)

    ncols = len(rows[0])

    columns = []
    for i in range(ncols):
	column = []
	for row in rows:
	    column.append(row[i])
	columns.append('[' + ','.join(column) + ']\n')

    print 'probabilityMap = ' + '[' + ','.join(columns) + ']'
else:
    print 'probabilityMap = null;'
