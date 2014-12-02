/*
 * Copyright (C) Foswiki Contributors 2010-2014
 * Author: Crawford Currie http://c-dot.co.uk
 * Javascript implementation of TablePlugin
 * Uses the jQuery tablesorter plugin
 */
(function($) {
    var jqtp = {
        // Mappings for tableframe attributes
        tableframe: {
            'void':   'none',
            'above':  'solid none none none',
            'below':  'none none solid none',
            'lhs':    'none none none solid',
            'rhs':    'none solid none none',
            'hsides': 'solid none solid none',
            'vsides': 'none solid none solid',
            'box':    'solid',
            'border': 'solid'
        },

        defaultOpts: {
          debug: true,
          widgets: ['colorize']
        },

        // Process elements marked with "jqtp_process". These are generated
        // when %TABLE tags are expanded.
        process : function() {
            $(this).removeClass("jqtp_process");
            var pdata = '({' + $(this).attr('title') + '})';
            var params = eval(pdata);
            var table = jqtp.nextTable(this);
            if (!table) {
                return;
            }
            $(table).attr("jqtp_params", pdata);
            jqtp.doTable(params, $(table));
            $(this).remove();
        },
        
        // Find the next TABLE tag after the given element. This matches
        // a %TABLE with the following <table>
        nextTable : function(el) {
            if (el === null) {
                return null;
            }
            do {
                // Zoom up
                while (el.nextSibling === null) {
                    if (el.parentNode === null) {
                        return null; // end of the road
                    } else {
                        el = el.parentNode;
                    }
                }
                // Next
                el = el.nextSibling;
                // Zoom down; stop and visit tables we pass on the way
                while (el.tagName != 'TABLE' && el.firstChild) {
                    el = el.firstChild;
                }
            } while (el && el.tagName != 'TABLE');
            return el;
        },

        // Add units to a number, for CSS
        unitify : function(n) {
            if (/^\d+$/.test(n)) {
                return n + "px";
            } else {
                return n;
            }
        },

        // Apply the given %TABLE params (p) to a table (t)
        doTable : function(p, t) {
            if (p.id !== undefined) {
                t.id = p.id;
            }
            if (p.summary !== undefined) {
                t.summary = p.summary;
            }
            if (p.caption !== undefined) {
                t.append("<caption>" + p.caption + "</caption>");
            }

            var hrc = p.headerrows;
            var frc = p.footerrows;

            jqtp.cleanHeadAndFoot(t, hrc, frc);

            jqtp.processRowspans(t);

            jqtp.colours(p, t);
            jqtp.borders(p, t);
            jqtp.layout(p, t);
            jqtp.align(p, t);
            if (p.sort == "on" && (p.disableallsort != "on")) {
                t.addClass("jqtp_sortable");
            }
        },

        // Find cell-collapse marks (^) and assign a rowspan
        // to the first non-^ cell in the rows above. This does
        // embedded table correctly too.
        processRowspans : function(t) {
            var span = /^\s*\^\s*$/;
            var trs = t.find("tr");
            trs.each(
                function () {
                    $(this).find("td,th")
                        .filter(
                            function() {
                                return !$(this).hasClass("jqtpRowspanned")
                                    && span.test( $(this).text() )
                            })
                        .each(
                            function() {
                                var offset = $(this).prevAll().length;
                                var rb = $(this);
                                do {
                                    rb = rb.parent().prev()
                                        .children().eq(offset);
                                } while (rb.hasClass("jqtpRowspanned"));
                                if (rb.attr("rowspan") == undefined)
                                    rb.attr("rowspan", 1);
                                rb.attr("rowspan",
                                        parseInt(rb.attr("rowspan")) + 1);
                                $(this).addClass("jqtpRowspanned");
                            });
                });
            // Now chop out the spanned cells
           t.find(".jqtpRowspanned").remove();
        },

        // try and pull out head and foot. The browser does this job
        // itself, at least for the head and the body - at least, Chrome
        // does and probably other webkit browsers too.
        // hrc and frc are advisory header and footer row counts
        cleanHeadAndFoot : function(table, hrc, frc) {
            var tbodys = table.children('tbody');
            var tbody;

            if (tbodys.length == 0) {
                // Browsers won't normally allow this to happen,
                // but just in case, if there's no tbody, create one
                tbody = $('<tbody></tbody>');
                var thead = table.children('THEAD');
                if (thead.length > 0)
                    // stick it after the first thead
                    tbody.insertAfter(thead.first());
                else
                    // ... or at the start of the table
                    table.prepend(tbody);
                // Move all TR's into the tbody
                tbody.append(table.children('TR').remove());
            }
            else
                // Hope there's only one!
                tbody = tbodys.first();

            var theads = table.children('thead');
            // Existance of a thead means hrc is ignored
            if (theads.length == 0) {
                // No THEAD, but body may have rows containing TH's.
                // See how many.
                var thcount = 0;
                var children = tbody.children('TR');
                var headrows = [];
                if (hrc == undefined)
                   hrc = children.length;
                while (thcount < hrc) {
                    var kid = $(children[thcount]);
                    if (!kid.children().first().is('TH'))
                        break;
                    headrows.push(kid);
                    thcount++;
                }

                if (hrc > thcount)
                    hrc = thcount;

                if (hrc > 0) {
                    table.prepend("<thead></thead>");
                    var thead = table.children('thead');
                    while (hrc--) {
                        var brat = headrows.shift();
                        thead.append(brat.remove());
                    }
                }
            }

            var tfoots = table.children('TFOOT');
            // Existance of a tfoot means frc is ignored
            if (tfoots.length > 0 && tfoots.first().children().length == 0) {
                // There's a bug in Render.pm that makes it generate
                // an empty tfoot even if there are footer rows
                // Remove empty tfoot and recompute
                tfoots[0].remove();
                tfoots = table.children('tfoot');
            }

            if (tfoots.length == 0 && frc !== undefined) {
                // No TFOOT, but body may contain enough rows to make one
                var tdcount = 0;
                var children = tbody.children('TR');
                var footrows = [];

                // Can't have more rows in the footer than exist
                if (frc > children.length)
                    frc = children.length;

                while (tdcount < frc) {
                    var kid = $(children[children.length - 1 - tdcount]);
                    if (!kid.children().first().is('TD,TH'))
                        break;
                    footrows.push(kid);
                    tdcount++;
                }

                if (tdcount > 0) {
                    table.append("<tfoot></tfoot>");
                    var tfoot = table.children('tfoot');
                    while (frc--) {
                        var brat = footrows.pop();
                        tfoot.append(brat.remove());
                    }
                }
            }
        },

        // handle colour options
        colours : function(p, t) {
            var h,c,i;
            if (p.headerbg !== undefined || p.headercolor !== undefined) {
                h = t.find('thead').add(t.find('tfoot'));
                if (h.length) {
                    if (p.headerbg !== undefined) {
                        h.css("background-color", p.headerbg);
                    }
                    if (p.headercolor !== undefined) {
                        h.css("color", p.headercolor);
                    }
                }
            }
            if (p.databg !== undefined || p.datacolor !== undefined) {
                h = t.find('tbody > tr');
                if (h.length) {
                    if (p.databg !== undefined) {
                        c = p.databg.split(/\s*,\s*/);
                        for (i = 0; i < h.length; i++) {
                            $(h[i]).css("background-color",
                                        c[i % c.length]);
                        }
                    }
                    if (p.datacolor !== undefined) {
                        c = p.datacolor.split(/\s*,\s*/);
                        for (i = 0; i < h.length; i++) {
                            $(h[i]).css("color",
                                        c[i % c.length]);
                        }
                    }
                }
            }
        },

        // handle border options
        borders: function(p, t) {
            if (p.tableborder !== undefined) {
                t[0].border = p.tableborder;
            }
            if (p.tableframe !== undefined && jqtp.tableframe[p.tableframe] !== undefined) {
                t.css('border-style', jqtp.tableframe[p.tableframe]);
            }
            if (p.tablerules === undefined) {
                p.tablerules = "rows";
            }
            t[0].rules = p.tablerules;
            if (p.cellborder !== undefined) {
                t.find("td").add(t.find("th"))
                    .css("border-width", jqtp.unitify(p.cellborder));
            }
        },

        // handle layout options
        layout: function(p, t) {
            if (p.cellpadding !== undefined) {
                t[0].cellPadding = p.cellpadding;
            }
            if (p.cellpadding !== undefined) {
                t[0].cellSpacing = p.cellspacing;
            }
            if (p.tablewidth !== undefined) {
                t[0].width = p.tablewidth;
            }
            if (p.columnwidths !== undefined) {
                var cw = p.columnwidths.split(/\s*,\s*/);
                var h = t.find('tr').each(
                    function() {
                        var i = 0;
                        var kid = this.firstChild;
                        while (kid && i < cw.length) {
                            var cs = kid.colSpan;
                            if (cs < 1) {
                              cs = 1;
                            }
                            // Skip columns with a colspan > 1
                            if (cs == 1) {
                                $(kid).css("width", jqtp.unitify(cw[i]));
                            }
                            i += cs;
                            do {
                                kid = kid.nextSibling;
                            } while (kid && kid.nodeType != 1);
                        }
                    });
            }
        },

        // handle alignment options
        align : function(p, t) {
            if (p.valign === undefined) {
                p.valign = "top";
            }
            if (p.headervalign === undefined) {
                p.headervalign = p.valign;
            }
            if (p.datavalign === undefined) {
                p.datavalign = p.valign;
            }

            t.find("thead > tr > th")
            .add(t.find("thead > tr > td"))
            .add(t.find("tfoot > tr > th"))
            .add(t.find("tfoot > tr > td"))
            .css("vertical-align", p.headervalign);

            t.find("tbody > tr > td")
            .add(t.find("tbody > tr > th"))
            .css("vertical-align", p.datavalign);

            if (p.headeralign) {
                t.find("thead > tr > th")
                    .add(t.find("thead > tr > td"))
                    .add(t.find("tfoot > tr > th"))
                    .add(t.find("tfoot > tr > td"))
                    .css("text-align", p.headeralign);
            }
            if (p.dataalign) {
                t.find("tbody > tr > td")
                    .add(t.find("tbody > tr > th"))
                    .css("text-align", p.headeralign);
            }
        },

        // handle sort options; cache them on the table for picking up when
        // we init tablesorter
        makeSortable : function(elem) {
            var sortOpts = $.extend({}, jqtp.defaultOpts),
                $elem = $(elem);
                pdata = $elem.attr("jqtp_params");

            if (pdata !== undefined) {
                $elem.removeAttr("jqtp_params");
                var p = eval(pdata);
                var sortcol = [0, 0];

                if (p.initSort !== undefined) {
                    sortcol[0] = p.initSort - 1;
                    sortOpts.sortList = [sortcol];
                }
                if (p.initdirection !== undefined) {
                    sortcol[1] = (p.initdirection == "down") ? 1 : 0;
                    sortOpts.sortList = [sortcol];
                }

                if (p.databgsorted !== undefined) {

                    var className = 'jqtp_databgsorted_' +
                        p.databgsorted.replace(/\W/g, '_');

                    /* Simplification; rather than pissing about colouring
                       alternate rows, paint all rows the same colour. */
                    var cols = p.databgsorted.split(/\s*,\s*/);
                    var col = cols[0];

                    $("body").append('<style type="text/css">.' + className +
                                     '{background-color:' + col +
                                     '}</style>');
                    sortOpts.cssAsc = className;
                    sortOpts.cssDesc = className;
                }
            }
            if (!$elem.find("thead").length) {
                jqtp.cleanHeadAndFoot($elem);
            }

            $elem.tablesorter(sortOpts);
        }

    };

    // colorize columns
    $.tablesorter.addWidget({
      id: 'colorize',
      format: function(table) {
        $(".sorted", table).removeClass("sorted");
        $("th.headerSortDown, th.headerSortUp", table).each(function() {
          var index = this.cellIndex +1;
          $("td:nth-child("+index+")", table).addClass("sorted");
        });
      }
    });

    // add javascript date parser
    $.tablesorter.addParser({
        id: "date",
        is: function (s) {
            return !isNaN((new Date(s)).getTime());
        }, format: function (s) {
            return $.tablesorter.formatFloat(new Date(s).getTime());
        }, type: "numeric"
    });

    /// document ready
    $(function() {
      // Process tables with a %TABLE tag
      $(".jqtp_process").livequery(jqtp.process);

      // If sort is all, attach the sortable class to all tables
      var selector = ".jqtp_sortable",
          sort = foswiki.getPreference("JQTablePlugin.sort");

      if (sort) {
          if (sort == 'all') {
              selector += ", .foswikiTable";
          } else if (sort == 'attachments') {
              // Just attachments
              selector += ", .foswikiAttachments table";
          }
      }

      // Process tables marked as sortable
      $(selector).livequery(function() {
        $(this).addClass("jqtp_sortable");
        jqtp.makeSortable(this);
      });
    });

})(jQuery);
