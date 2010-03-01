/*
 * Copyright (C) Foswiki Contributors 2010
 * Author: Crawford Currie http://c-dot.co.uk
 * Javascript implementation of TablePlugin
 * Uses the jQuery tablesorter plugin
 */
jQuery(document).ready(
    function($) {
        var jqtp = {
            // Mappings for tableframe attributes
            tableframe: {
                void:   'none',
                above:  'solid none none none',
                below:  'none none solid none',
                lhs:    'none none none solid',
                rhs:    'none solid none none',
                hsides: 'solid none solid none',
                vsides: 'none solid none solid',
                box:    'solid',
                border: 'solid'
            },

            // Process elements marked with "jqtp_process". These are generated
            // when %TABLE tags are expanded.
            process : function() {
                $(".jqtp_process").each(
                    function() {
                        // Find the next table in the DOM
                        var pdata = $(this).text();
                        var params = eval('('+pdata+')');
                        var table = jqtp.nextTable(this);
                        $(this).remove();
                        if (!table)
                            return;
                        table = $(table);
                        jqtp.doTable(params, table);
                    });
            },
            
            // Find the next TABLE tag after the given element. This matches
            // a %TABLE with the following <table>
            nextTable : function(el) {
                if (el == null)
                    return null;
                do {
                    // Zoom up
                    while (el.nextSibling == null) {
                        if (el.parentNode == null)
                            return null; // end of the road
                        else
                            el = el.parentNode;
                    }
                    // Next
                    el = el.nextSibling;
                    // Zoom down; stop and visit tables we pass on the way
                    while (el.tagName != 'TABLE' && el.firstChild)
                        el = el.firstChild;
                } while (el && el.tagName != 'TABLE');
                return el;
            },

            // Add units to a number, for CSS
            unitify : function(n) {
                if (/^\d+$/.test(n))
                    return n + "px";
                else
                    return n;
            },

            // Apply the given %TABLE params (p) to a table (t)
            doTable : function(p, t) {
                if (p.id != undefined)
                    t.id = p.id;
                if (p.summary != undefined)
                    t.summary = p.summary;
                if (p.caption != undefined)
                    t.append("<caption>" + p.caption + "</caption>");

                var hrc = p.headerrows;
                var frc = p.footerrows;

                var bodies = t.find('tbody');
                var b = bodies[0];
                var h = t.find('thead');
                
                if (h.length == 0 && b.firstChild) {
                    // No THEAD, but TBODY has some rows
                    if (hrc != undefined) {
                        if (hrc > $(b).children().length)
                            hrc = $(b).children().length;
                    } else {
                        // See if we can find header rows by groping
                        hrc = 0;
                        var fc = b.firstChild;
                        while (fc && fc.firstChild.tagName == 'TH') {
                            hrc++;
                            fc = fc.nextSibling;
                        }
                    }
                    if (hrc > 0) {
                        bodies.before("<thead></thead>");
                        h = t.find('thead');
                        while (hrc--) {
                            var bratz = $(b).children();
                            h.append($(bratz[0]).remove());
                        }
                    }
                }

                var f = t.find('tfoot');
                if (f.length == 0 && $(b).children().length > 0 && frc > 0) {
                    // No TFOOT, are there enough rows in the body?
                    if (frc > $(b).children().length)
                        frc = $(b).children().length;
                    if (frc > 0) {
                        bodies.after("<tfoot></tfoot>");
                        f = t.find('tfoot');
                        while (frc--) {
                            var bratz = $(b).children();
                            f.append($(bratz[bratz.length - 1]).remove());
                        }
                    }
                }
            
                jqtp.colours(p, t);
                jqtp.borders(p, t);
                jqtp.layout(p, t);
                jqtp.align(p, t);
                if (p.sort == "on" && (p.disableallsort != "on")) {
                    t.addClass("jqtp_sortable");
                    jqtp.sorts(p, t);
                }
            },

            // handle sort options
            sorts : function(p, t) {
                var sortcol = p.initSort;
                if (sortcol <= 0) sortcol = 1;
                var sortdir = p.initdirection;
                var sortcolbg = p.databgsorted
            },

            // handle colour options
            colours : function(p, t) {
                if (p.headerbg != undefined || p.headercolor != undefined) {
                    var h = t.find('thead').add(t.find('tfoot'));
                    if (h.length) {
                        if (p.headerbg != undefined)
                            h.css("background-color", p.headerbg);
                        if (p.headercolor != undefined)
                            h.css("color", p.headercolor);
                    }
                }
                if (p.databg != undefined || p.datacolor != undefined) {
                    var h = t.find('tbody > tr');
                    if (h.length) {
                        if (p.databg != undefined) {
                            var c = p.databg.split(/\s*,\s*/);
                            for (var i = 0; i < h.length; i++) {
                                $(h[i]).css("background-color",
                                            c[i % c.length]);
                            }
                        }
                        if (p.datacolor != undefined) {
                            var c = p.datacolor.split(/\s*,\s*/);
                            for (var i = 0; i < h.length; i++) {
                                $(h[i]).css("color",
                                            c[i % c.length]);
                            }
                        }
                    }
                }
            },

            // handle border options
            borders: function(p, t) {
                if (p.tableborder != undefined)
                    t[0].border = p.tableborder;
                if (p.tableframe != undefined && jqtp.tableframe[p.tableframe] != undefined)
                    t.css('border-style', jqtp.tableframe[p.tableframe]);
                if (p.tablerules == undefined)
                    p.tablerules = "rows";
                t[0].rules = p.tablerules;
                if (p.cellborder != undefined) {
                    t.find("td").add(t.find("th"))
                        .css("border-width", jqtp.unitify(p.cellborder));
                }
            },

            // handle layout options
            layout: function(p, t) {
                if (p.cellpadding != undefined)
                    t[0].cellPadding = p.cellpadding;
                if (p.cellpadding != undefined)
                    t[0].cellSpacing = p.cellspacing;
                if (p.tablewidth != undefined)
                    t[0].width = p.tablewidth;
                if (p.columnwidths != undefined) {
                    var cw = p.columnwidths.split(/\s*,\s*/);
                    var h = t.find('tr').each(
                        function() {
                            var i = 0;
                            var kid = this.firstChild;
                            while (kid && i < cw.length) {
                                var cs = kid.colSpan;
                                if (cs < 1) cs = 1;
                                // Skip columns with a colspan > 1
                                if (cs == 1)
                                    $(kid).css("width", jqtp.unitify(cw[i]));
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
                if (p.valign == undefined)
                    p.valign = "top";
                if (p.headervalign == undefined) 
                    p.headervalign = p.valign;
                if (p.datavalign == undefined) 
                    p.datavalign = p.valign;

                t.find("thead > tr > th")
                .add(t.find("thead > tr > td"))
                .add(t.find("tfoot > tr > th"))
                .add(t.find("tfoot > tr > td"))
                .css("vertical-align", p.headervalign);

                t.find("tbody > tr > td")
                .add(t.find("tbody > tr > th"))
                .css("vertical-align", p.datavalign);

                if (p.headeralign)
                    t.find("thead > tr > th")
                        .add(t.find("thead > tr > td"))
                        .add(t.find("tfoot > tr > th"))
                        .add(t.find("tfoot > tr > td"))
                        .css("text-align", p.headeralign);
                if (p.dataalign)
                    t.find("tbody > tr > td")
                        .add(t.find("tbody > tr > th"))
                        .css("text-align", p.headeralign);
            }
        };

        // Process tables with a %TABLE tag
        jqtp.process();

        // If sort is all, attach the sortable class to all tables
        var sort = $("meta[name='JQTABLEPLUGINSORT']").attr("content");
        if (sort) {
            if (sort == 'all')
                $("table").addClass("jqtp_sortable");
            else if (sort == 'attachments')
                // Just attachments
                $(".foswikiAttachments table").addClass("jqtp_sortable");
        }

        // Process tables marked as sortable
        $(".jqtp_sortable").tablesorter();
    });
