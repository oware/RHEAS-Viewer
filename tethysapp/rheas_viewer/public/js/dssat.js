/*****************************************************************************
 * FILE:    DSSAT MAIN JS
 * DATE:    22 AUGUST 2017
 * AUTHOR: Sarva Pulla
 * COPYRIGHT: (c) NASA SERVIR 2017
 * LICENSE: BSD 2-Clause
 *****************************************************************************/

/*****************************************************************************
 *                      LIBRARY WRAPPER
 *****************************************************************************/

var LIBRARY_OBJECT = (function() {
    // Wrap the library in a package function
    "use strict"; // And enable strict mode for this library

    /************************************************************************
     *                      MODULE LEVEL / GLOBAL VARIABLES
     *************************************************************************/
    var current_schemas,
        ensemble_info,
        gwad_low,
        gwad_high,
        layers,
        map,
        public_interface,			// Object returned by the module
        selectedFeatures,
        vectorSource,
        vectorLayer,
        wfs_url,
        wfs_workspace,
        wms_layer,
        wms_source,
        yield_data;



    /************************************************************************
     *                    PRIVATE FUNCTION DECLARATIONS
     *************************************************************************/
    var generate_chart,
        hide_charts,
        init_dropdown,
        init_events,
        init_all,
        init_map,
        init_vars;


    /************************************************************************
     *                    PRIVATE FUNCTION IMPLEMENTATIONS
     *************************************************************************/

    init_vars = function(){
        var $dssat_element = $('#dssat');
        current_schemas = {"2010":["ken_2010_mam_high","ken_2010_mam_med"],"2011":["ken_2011_mam_high","ken_2011_mam_med"],"2012":["ken_2012_mam_high"],
            "2013":["ken_2013_mam_high","ken_2013_mam_med"],"2014":["ken_2014_mam_high","ken_2014_mam_med"],"2015":["ken_2015_mam_low"],"2016":["ken_2016_mam_high","ken_2016_mam_med"]};

        wfs_url = $dssat_element.attr('data-geoserver-url');
        wfs_workspace = $dssat_element.attr('data-geoserver-workspace');
    };

    init_map = function() {
        var projection = ol.proj.get('EPSG:3857');
        var baseLayer = new ol.layer.Tile({
            source: new ol.source.OSM()
        });

// new ol.source.BingMaps({
//                 key: '5TC0yID7CYaqv3nVQLKe~xWVt4aXWMJq2Ed72cO4xsA~ApdeyQwHyH_btMjQS1NJ7OHKY8BK-W-EMQMrIavoQUMYXeZIQOUURnKGBOC7UCt4',
//                 imagerySet: 'AerialWithLabels' // Options 'Aerial', 'AerialWithLabels', 'Road'
//             })
        var view = new ol.View({
            center: ol.proj.transform([32,0], 'EPSG:4326','EPSG:3857'),
            projection: projection,
            zoom: 7
        });
        wms_source = new ol.source.ImageWMS();

        wms_layer = new ol.layer.Image({
            source: wms_source
        });

        var high = [64,196,64,0.81];
        var mid = [108,152,64,0.81];
        var low = [152,108,64,0.81];
        var poor = [196,32,32,0.81];

        vectorSource = new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: function(extent) {
                return wfs_url+'?service=WFS&' +
                    'version=1.1.0&request=GetFeature&typename='+wfs_workspace+':agareas&' +
                    'outputFormat=application/json&srsname=EPSG:3857&' +
                    'bbox=' + extent.join(',') + ',EPSG:3857';
            },
            strategy: ol.loadingstrategy.bbox,
            wrapX: false
        });

        var styleCache = {};

        var default_style = new ol.style.Style({
            fill: new ol.style.Fill({
                color: [250,250,250,1]
            }),
            stroke: new ol.style.Stroke({
                color: [220,220,220,1],
                width: 4
            })
        });

        function styleFunction(feature, resolution) {
            // get the incomeLevel from the feature properties
            var level = feature.getId().split(".")[1];
            if(yield_data != null){
                // var index = yield_data.findIndex(function(x) { return x[0]==level });
                var index = -1;
                for (var i = 0; i < yield_data.length; ++i) {
                    if (yield_data[i][0] == level) {
                        index = i;
                        break;
                    }
                }

                if (index=="-1") {
                    return [default_style];
                }
                // check the cache and create a new style for the income
                // level if its not been created before.
                if (index!="-1") {
                    var avg_val = yield_data[index][1];

                    if(avg_val > 2000){
                        styleCache[index] = new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: high
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#030303',
                                width: 3
                            })
                        });
                    }else if(avg_val > 1500 && avg_val < 2000){
                        styleCache[index] = new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: mid
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#030303',
                                width: 3
                            })
                        });
                    }else if(avg_val > 1000 && avg_val < 1500){
                        styleCache[index] = new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: low
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#030303',
                                width: 3
                            })
                        });
                    }else if(avg_val < 1000){
                        styleCache[index] = new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: poor
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#030303',
                                width: 3
                            })
                        });
                    }

                }
                return [styleCache[index]];
            }else{
                return [default_style];
            }

        }

        vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            style: styleFunction
        });

        layers = [baseLayer,vectorLayer];

        map = new ol.Map({
            target: document.getElementById("map"),
            layers: layers,
            view: view
        });

        // Overlay
        var menu = new ol.control.Overlay ({ closeBox : true, className: "slide-left menu", content: $("#menu"),overflow:true});
        map.addControl(menu);
        menu.show();
        // A toggle control to show/hide the menu
        var t = new ol.control.Toggle(
            {	html: '<i class="fa fa-bars" ></i>',
                className: "menu",
                title: "Menu",
                onToggle: function() { menu.toggle(); }
            });
        map.addControl(t);
        map.crossOrigin = 'anonymous';
        var select_interaction = new ol.interaction.Select({
            layers: [vectorLayer],
            style:new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 0, 255, 1.0)',
                    width: 6
                }),
                fill: new ol.style.Fill({
                    color: 'rgba(48, 252, 7,1.0)'
                })
            }),
            wrapX: false
        });

        map.addInteraction(select_interaction);
        // select_interaction.on('select', function (e) {
        //     var gid = e.selected[0].getId();
        //     console.log(gid);
        //     menu.show();
        // });

        selectedFeatures = select_interaction.getFeatures();
        selectedFeatures.on('add', function(event) {
            $(".error").html('');
            var feature = event.target.item(0);
            var gid = feature.getId().split(".")[1];
            var schema = $("#schema_table option:selected").val();
            $("#gid").val(gid);
            $("#schema").val(schema);

            var name_0 = feature.getProperties().name_0;
            var name_1 = feature.getProperties().name_1;
            var name_2 = feature.getProperties().name_2;

            // var heading = $("<div>").append( $("<h3>").text(name_0));
            // var content = $("<div>")
            //     .append(heading);
            $(".feature-info").html('<h4 style="display: inline;">Current Feature: '+name_0+'&#8594</h4>&nbsp&nbsp<h5 style="display: inline;">'+name_1+'&#8594</h5>&nbsp&nbsp<h6 style="display: inline;">'+name_2+'</h6>');
            menu.show();
            var xhr = ajax_update_database("get-ensemble",{"gid":gid,"schema":schema});
            xhr.done(function(data) {
                if("success" in data) {
                    $(".ensemble").removeClass('hidden');
                    $("#ens_table").html('');
                    var ensembles = data.ensembles;
                    $("#ens_table").append(new Option("Median","avg")).trigger('change');
                    ensembles.forEach(function(ensemble,i){
                        var new_option = new Option(ensemble,ensemble);
                        $("#ens_table").append(new_option);
                    });
                } else {
                    $(".error").append('<h3>Error Retrieving the ensemble data. Please select another feature.</h3>');

                }
            });
        });

        // when a feature is removed, clear the feature-info div
        selectedFeatures.on('remove', function(event) {
            $(".feature-info").html("");
            $(".ensemble").addClass('hidden');
            hide_charts();
            $(".feature-info").html("<p>Please select a feature to View the relevant metadata.</p>");
        });


    };

    init_events = function(){
        (function () {
            var target, observer, config;
            // select the target node
            target = $('#app-content-wrapper')[0];

            observer = new MutationObserver(function () {
                window.setTimeout(function () {
                    map.updateSize();
                }, 350);
            });
            $(window).on('resize', function () {
                map.updateSize();
            });

            config = {attributes: true};

            observer.observe(target, config);
        }());

    };

    init_all = function(){
        init_vars();
        init_dropdown();
        init_map();
        init_events();
    };

    init_dropdown = function () {
        $(".ens_table").select2();
        $(".year_table").select2();
        $(".schema_table").select2();
    };

    generate_chart = function(id,data,units,title){
        $("#"+id).highcharts({
            chart: {
                zoomType: 'x'
            },
            title: {
                text:title
            },
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    }
                }
            },
            xAxis: {
                type: 'datetime',
                labels: {
                    format: '{value:%d %b}'
                },
                title: {
                    text: 'Date'
                }
            },
            yAxis: {
                title: {
                    text: units
                }

            },
            exporting: {
                enabled: true
            },
            series: [{
                data:data,
                name: units,
                type:'line',
                lineWidth:5,
                color:"green"
            }]
        });
    };

    hide_charts = function(){
        $("#wsgd-chart").addClass('hidden');
        $("#lai-chart").addClass('hidden');
        $("#gwad-chart").addClass('hidden');
        $('.active').removeClass('active');
    };

    /************************************************************************
     *                        DEFINE PUBLIC INTERFACE
     *************************************************************************/

    public_interface = {

    };

    /************************************************************************
     *                  INITIALIZATION / CONSTRUCTOR
     *************************************************************************/

    // Initialization: jQuery function that gets called when
    // the DOM tree finishes loading
    $(function() {
        init_all();

        $("#year_table").change(function(){
            var year = $("#year_table option:selected").val();

            $("#schema_table").html('');
            current_schemas[year].forEach(function(schema,i){
                var new_option = new Option(schema,schema);
                if(i==0){
                    $("#schema_table").append(new_option).trigger('change');
                }else{
                    $("#schema_table").append(new_option);
                }
            });

        }).change();


        $("#schema_table").change(function(){
            $(".error").html('');
            var schema = $("#schema_table option:selected").val();
            var xhr = ajax_update_database("get-schema-yield",{"schema":schema});
            xhr.done(function(data) {
                if("success" in data) {
                    yield_data = data.yield;
                    selectedFeatures.clear();
                    vectorLayer.getSource().changed();
                } else {
                    $(".error").append('<h3>Error Processing Request. Please be sure to select an area/schema with data.</h3>');
                }
            });
        }).change();

        $("#ens_table").change(function(){
            $(".error").html('');
            var gid = $("#gid").val();
            var schema = $("#schema").val();
            var ens = $("#ens_table option:selected").val();

            if($("#gwad-chart").highcharts()){
                // var gwad_chart = $("#gwad-chart").highcharts();
                // gwad_chart.destroy();
                // var wsgd_chart = $("#wsgd-chart").highcharts();
                // wsgd_chart.destroy();
                // var lai_chart = $("#lai-chart").highcharts();
                // lai_chart.destroy();
                $('#gwad-chart').remove();
                $('#wsgd-chart').remove();
                $('#lai-chart').remove();
                $("#menu").append('<div id="wsgd-chart" name="wsgd-chart" style="height:100%;width:100%" class="hidden"></div>');
                $("#menu").append('<div id="lai-chart" name="lai-chart" style="height:100%;width:100%" class="hidden"></div>');
                $("#menu").append('<div id="gwad-chart" name="gwad-chart" style="height:100%;width:100%" class="hidden"></div>');
            }

            var xhr = ajax_update_database("get-ens-values",{"gid":gid,"schema":schema,"ensemble":ens});

            xhr.done(function(data) {
                if("success" in data) {

                    generate_chart('gwad-chart',data.gwad_series,'Grain Weight (kg/ha)','Grain Weight');
                    generate_chart('wsgd-chart',data.wsgd_series,'Water Stress Index','Water Stress Index Values');
                    generate_chart('lai-chart',data.lai_series,'LAI (m2/m2)','Leaf Area Index');
                    hide_charts();
                    $("#view-gwad").click();
                    if("low_gwad_series" in data){
                        gwad_low = data.low_gwad_series;
                        gwad_high = data.high_gwad_series;
                        ensemble_info = data.ensemble_info;
                    }

                    if(gwad_low != "null"){
                        $(".ensemble-info").html('');
                        var chart = $("#gwad-chart").highcharts();

                        if (chart.series.length === 1) {
                            $(".ensemble-info").html('<p style="display: inline;">25th Percentile Ensemble: '+ensemble_info[0]+', Median Ensemble: '+ensemble_info[1]+', 75th Percentile Ensemble: '+ensemble_info[2]+'</p>');
                            chart.addSeries({
                                data:gwad_low,
                                name: "25th Percentile",
                                type:'line',
                                color:"red",
                                fillOpacity:0.1,
                                zIndex:-1,
                                dashStyle: "Dash"

                            });
                            chart.addSeries({
                                data: gwad_high,
                                name: "75th Percentile",
                                type:'line',
                                color:"orange",
                                fillOpacity:0.1,
                                zIndex:-2,
                                dashStyle: "Dash"

                            });
                        }
                    }

                } else {
                    $(".error").append('<h3>Error Processing Request. Please be sure to select an area with data.</h3>');

                }

            });


        });

        $("#render button").click(function(e) {
            var isActive = $(this).hasClass('active');

            hide_charts();
            if (!isActive) {
                $(this).addClass('active');
                $("#"+$(this).data('chart-id')).removeClass('hidden');
            }
        });
        $('.feature-info').is(':empty') ? $(".feature-info").html("<p>Please select a feature to View the relevant metadata.</p>") : $(".feature-info").html("");

    });

    return public_interface;

}()); // End of package wrapper
// NOTE: that the call operator (open-closed parenthesis) is used to invoke the library wrapper
// function immediately after being parsed.