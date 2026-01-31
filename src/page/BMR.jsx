import "./BMR.css";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { supabase } from '../supabaseClient';

function BMR({ 
  bmrList, 
  setBmrList, 
  bmrTemplates, 
  setBmrTemplates, 
  activeProductionDepartment,
  loadAllData, 
  products, 
  setProducts,
  processTemplates,
  setProcessTemplates,
  globalTemplates,
  setGlobalTemplates
}) {
    const [bmrProducts, setBmrProducts] = useState([]);
    const [newProductName, setNewProductName] = useState("");
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingAssembly, setEditingAssembly] = useState(null);
    const [newAssemblyName, setNewAssemblyName] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedMainAssembly, setSelectedMainAssembly] = useState(null);
    const [selectedBMR, setSelectedBMR] = useState(null);
    const [newBMR, setNewBMR] = useState({
        name: "",
        type: "assembly",
        initialCode: "",
        status: "active"
    });
    const [editingBMR, setEditingBMR] = useState(null);

    // Process Management States
    const [showProcessModal, setShowProcessModal] = useState(false);
    const [showAddProcessModal, setShowAddProcessModal] = useState(false);
    const [selectedBMRForProcess, setSelectedBMRForProcess] = useState(null);
    const [processes, setProcesses] = useState([]);
    const [newProcess, setNewProcess] = useState({
        name: "",
        amount: "",
        handler: "",
        status: "initiate"
    });

    // Process Templates States
    const [showProcessTemplateModal, setShowProcessTemplateModal] = useState(false);
    const [newProcessTemplate, setNewProcessTemplate] = useState({
        handler_name: "",
        amount: ""
    });

    // Global Process Templates States
    const [showGlobalProcessTemplateModal, setShowGlobalProcessTemplateModal] = useState(false);
    const [showLoadProcessTemplateModal, setShowLoadProcessTemplateModal] = useState(false);
    const [newGlobalProcessTemplate, setNewGlobalProcessTemplate] = useState({
        name: "",
        description: "",
        processes: [],
        is_public: true
    });
    const [globalProcessTemplates, setGlobalProcessTemplates] = useState([]);
    const [selectedGlobalProcessTemplate, setSelectedGlobalProcessTemplate] = useState(null);
    const [selectedTemplateForProcess, setSelectedTemplateForProcess] = useState(null);
    const [templateAction, setTemplateAction] = useState("new");

    // Multiple Handlers State
    const [showMultipleHandlersModal, setShowMultipleHandlersModal] = useState(false);
    const [selectedProcessForMultipleHandlers, setSelectedProcessForMultipleHandlers] = useState(null);
    const [multipleHandlers, setMultipleHandlers] = useState([]);
    const [newMultipleHandler, setNewMultipleHandler] = useState({
        name: "",
        amount: "",
        status: "initiate"
    });

    // Global Templates States
    const [showGlobalTemplateModal, setShowGlobalTemplateModal] = useState(false);
    const [showViewGlobalTemplateModal, setShowViewGlobalTemplateModal] = useState(false);
    const [newGlobalTemplate, setNewGlobalTemplate] = useState({
        name: "",
        description: "",
        category: "",
        template_data: [],
        is_public: true
    });
    const [selectedGlobalTemplate, setSelectedGlobalTemplate] = useState(null);
    const [globalTemplateAction, setGlobalTemplateAction] = useState("new");
    const [selectedExistingTemplate, setSelectedExistingTemplate] = useState(null);

    // Timer states for process management
    const [activeTimers, setActiveTimers] = useState({});
    const [timerStarts, setTimerStarts] = useState({});
    const [elapsedTimes, setElapsedTimes] = useState({});

    // Multiple Handler Timer States
    const [activeHandlerTimers, setActiveHandlerTimers] = useState({});
    const [handlerTimerStarts, setHandlerTimerStarts] = useState({});
    const [handlerElapsedTimes, setHandlerElapsedTimes] = useState({});

    // Saved Templates State
    const [savedTemplates, setSavedTemplates] = useState({});
    const [showSavedTemplates, setShowSavedTemplates] = useState(false);
    const [selectedSavedTemplate, setSelectedSavedTemplate] = useState(null);

    // BMR Completion State
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completedBMR, setCompletedBMR] = useState(null);
    const [newCompletedProduct, setNewCompletedProduct] = useState({
        BareCode: "",
        PartNo: "",
        LotNo: "",
        SNo: "",
        name: "",
        price: "",
        Quantity: "1.00"
    });

    // History State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [bmrHistory, setBmrHistory] = useState([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [historyFilter, setHistoryFilter] = useState({
        assemblyType: "all",
        searchTerm: ""
    });

    // Confirmation Modals
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({
        title: "",
        message: "",
        onConfirm: () => {},
        onCancel: () => {},
        confirmText: "Yes",
        cancelText: "No"
    });

    // Show confirmation modal
    const showConfirmation = (config) => {
        setConfirmConfig(config);
        setShowConfirmModal(true);
    };

    // Load BMR data from Supabase - FILTERED BY DEPARTMENT
    useEffect(() => {
        if (activeProductionDepartment) {
            loadBMRData();
            loadBMRHistory();
            loadSavedTemplates();
            loadProcesses();
            loadProcessTemplates();
            loadGlobalTemplates();
            loadGlobalProcessTemplates();
        }
    }, [activeProductionDepartment]);

    // Load Global Process Templates
    const loadGlobalProcessTemplates = async () => {
        try {
            const { data: templatesData, error: templatesError } = await supabase
                .from('global_process_templates')
                .select('*')
                .or(`department.eq.${activeProductionDepartment},department.is.null,is_public.eq.true`)
                .order('created_at', { ascending: false });

            if (!templatesError && templatesData) {
                setGlobalProcessTemplates(templatesData);
            }
        } catch (error) {
            console.error('Error loading global process templates:', error);
        }
    };

    // Add new global process template
    const addGlobalProcessTemplate = async () => {
        try {
            if (!newGlobalProcessTemplate.name.trim()) {
                toast.error('Please enter template name!');
                return;
            }

            if (!newGlobalProcessTemplate.processes || newGlobalProcessTemplate.processes.length === 0) {
                toast.error('Please add at least one process to the template!');
                return;
            }

            const templateToAdd = {
                name: newGlobalProcessTemplate.name.trim(),
                description: newGlobalProcessTemplate.description.trim(),
                processes: newGlobalProcessTemplate.processes,
                department: activeProductionDepartment,
                is_public: newGlobalProcessTemplate.is_public,
                created_by: 'System'
            };

            const { data, error } = await supabase
                .from('global_process_templates')
                .insert([templateToAdd])
                .select();

            if (error) throw error;

            setGlobalProcessTemplates(prev => [...prev, data[0]]);
            toast.success('Global process template added successfully!');
            setNewGlobalProcessTemplate({
                name: "",
                description: "",
                processes: [],
                is_public: true
            });
            setShowGlobalProcessTemplateModal(false);
        } catch (error) {
            toast.error('Error adding global process template: ' + error.message);
        }
    };

    // Update global process template
    const updateGlobalProcessTemplate = async () => {
        try {
            if (!selectedTemplateForProcess) {
                toast.error('Please select a template to update!');
                return;
            }

            if (!newGlobalProcessTemplate.processes || newGlobalProcessTemplate.processes.length === 0) {
                toast.error('Please add template processes!');
                return;
            }

            const { error } = await supabase
                .from('global_process_templates')
                .update({
                    processes: newGlobalProcessTemplate.processes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedTemplateForProcess.id);

            if (error) throw error;

            setGlobalProcessTemplates(prev =>
                prev.map(template =>
                    template.id === selectedTemplateForProcess.id
                        ? { ...template, processes: newGlobalProcessTemplate.processes }
                        : template
                )
            );
            toast.success('Global process template updated successfully!');
            setNewGlobalProcessTemplate({
                name: "",
                description: "",
                processes: [],
                is_public: true
            });
            setSelectedTemplateForProcess(null);
            setTemplateAction("new");
            setShowGlobalProcessTemplateModal(false);
        } catch (error) {
            toast.error('Error updating global process template: ' + error.message);
        }
    };

    // Load global process template into current BMR
    const loadGlobalProcessTemplate = async (template) => {
        if (!selectedBMRForProcess) {
            toast.error('Please select a BMR first!');
            return;
        }

        try {
            // Clear existing processes for this BMR
            await deleteAllBMRProcesses(selectedBMRForProcess.id);

            // Add all processes from template
            const newProcesses = [];
            for (const processTemplate of template.processes) {
                const processToAdd = {
                    template_id: selectedBMRForProcess.id,
                    name: processTemplate.name,
                    amount: 0,
                    handler: '',
                    status: 'initiate',
                    elapsed_time: 0,
                    is_timer_running: false,
                    department: activeProductionDepartment
                };

                const { data, error } = await supabase
                    .from('processes')
                    .insert([processToAdd])
                    .select();

                if (error) throw error;

                newProcesses.push({
                    ...data[0],
                    elapsedTime: 0,
                    isTimerRunning: false
                });
            }

            // Update local state
            setProcesses(prev => [...prev, ...newProcesses]);
            toast.success(`Loaded ${template.processes.length} processes from "${template.name}" template!`);
            setSelectedGlobalProcessTemplate(null);
            setShowLoadProcessTemplateModal(false);
            setShowProcessModal(true);
        } catch (error) {
            toast.error('Error loading global process template: ' + error.message);
        }
    };

    // Delete all processes for a BMR
    const deleteAllBMRProcesses = async (templateId) => {
        try {
            const { error } = await supabase
                .from('processes')
                .delete()
                .eq('template_id', templateId);

            if (error) throw error;

            setProcesses(prev => prev.filter(process => process.template_id !== templateId));
            
            // Clear timers for deleted processes
            const processesToDelete = processes.filter(p => p.template_id === templateId);
            processesToDelete.forEach(process => {
                delete activeTimers[process.id];
                delete timerStarts[process.id];
                delete elapsedTimes[process.id];
            });
        } catch (error) {
            console.error('Error deleting processes:', error);
        }
    };

    // Delete global process template
    const deleteGlobalProcessTemplate = async (templateId) => {
        showConfirmation({
            title: "Delete Global Process Template",
            message: "Are you sure you want to delete this global process template? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('global_process_templates')
                        .delete()
                        .eq('id', templateId);

                    if (error) throw error;

                    setGlobalProcessTemplates(prev => prev.filter(template => template.id !== templateId));
                    toast.success('Global process template deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting global process template: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Save to existing global process template
    const saveToExistingProcessTemplate = async () => {
        if (!selectedTemplateForProcess) {
            toast.error('Please select an existing template!');
            return;
        }

        try {
            await updateGlobalProcessTemplate();
        } catch (error) {
            toast.error('Error saving to existing template: ' + error.message);
        }
    };

    // Add process to global process template
    const addProcessToGlobalTemplate = () => {
        if (!newProcess.name.trim()) {
            toast.error('Please fill process name!');
            return;
        }

        const processToAdd = {
            name: newProcess.name.trim(),
            amount: 0,
            status: 'initiate'
        };

        setNewGlobalProcessTemplate(prev => ({
            ...prev,
            processes: [...prev.processes, processToAdd]
        }));

        setNewProcess({
            name: "",
            amount: "",
            handler: "",
            status: "initiate"
        });

        toast.success('Process added to template!');
    };

    // Remove process from global process template
    const removeProcessFromGlobalTemplate = (index) => {
        showConfirmation({
            title: "Remove Process",
            message: "Are you sure you want to remove this process from the template?",
            confirmText: "Remove",
            cancelText: "Cancel",
            onConfirm: () => {
                setNewGlobalProcessTemplate(prev => ({
                    ...prev,
                    processes: prev.processes.filter((_, i) => i !== index)
                }));
                toast.success('Process removed from template!');
            },
            onCancel: () => {}
        });
    };

    // Load BMR data from Supabase with decimal quantity support
    const loadBMRData = async () => {
        if (!activeProductionDepartment) {
            toast.error('No production department selected!');
            return;
        }

        try {
            const { data: productsData, error: productsError } = await supabase
                .from('bmr_products')
                .select('*')
                .eq('department', activeProductionDepartment)
                .order('created_at', { ascending: false });

            if (productsError) throw productsError;

            if (productsData) {
                const productsWithAssemblies = await Promise.all(
                    productsData.map(async (product) => {
                        const { data: assembliesData, error: assembliesError } = await supabase
                            .from('bmr_assemblies')
                            .select('*')
                            .eq('product_id', product.id)
                            .order('created_at', { ascending: true });

                        if (assembliesError) throw assembliesError;

                        const assembliesWithBMRs = await Promise.all(
                            (assembliesData || []).map(async (assembly) => {
                                const { data: templatesData, error: templatesError } = await supabase
                                    .from('bmr_templates')
                                    .select('*')
                                    .eq('assembly_id', assembly.id)
                                    .order('created_at', { ascending: true });

                                if (templatesError) throw templatesError;

                                const templatesWithData = await Promise.all(
                                    (templatesData || []).map(async (template) => {
                                        const { data: templateData, error: templateDataError } = await supabase
                                            .from('bmr_template_data')
                                            .select('*')
                                            .eq('template_id', template.id)
                                            .order('created_at', { ascending: true });

                                        if (templateDataError) throw templateDataError;

                                        // Parse variant details if available
                                        const parsedTemplateData = (templateData || []).map(item => {
                                            let variantDetails = [];
                                            if (item.variant_details) {
                                                try {
                                                    variantDetails = typeof item.variant_details === 'string' 
                                                        ? JSON.parse(item.variant_details) 
                                                        : item.variant_details;
                                                } catch (e) {
                                                    console.error('Error parsing variant details:', e);
                                                }
                                            }

                                            return {
                                                id: item.id,
                                                rawMaterial: item.raw_material,
                                                partNo: item.part_no,
                                                internalSerialNo: item.internal_serial_no,
                                                description: item.description,
                                                assemblyName: item.assembly_name,
                                                quantity: parseFloat(item.quantity) || 1.00,
                                                price: parseFloat(item.price) || 0,
                                                issuedBy: item.issued_by,
                                                receivedBy: item.received_by,
                                                variantDetails: variantDetails,
                                                totalQuantity: parseFloat(item.total_quantity) || parseFloat(item.quantity) || 1.00,
                                                averagePrice: parseFloat(item.average_price) || 0
                                            };
                                        });

                                        return {
                                            id: template.id,
                                            name: template.name,
                                            type: template.type,
                                            initialCode: template.initial_code,
                                            status: template.status,
                                            department: template.department,
                                            productId: product.id,
                                            assemblyId: assembly.id,
                                            templateData: parsedTemplateData
                                        };
                                    })
                                );

                                return {
                                    id: assembly.id,
                                    name: assembly.name,
                                    type: assembly.type,
                                    bmrs: templatesWithData
                                };
                            })
                        );

                        return {
                            id: product.id,
                            name: product.name,
                            department: product.department,
                            hasAssembly: product.has_assembly,
                            assemblies: assembliesWithBMRs
                        };
                    })
                );

                setBmrProducts(productsWithAssemblies);
            }
        } catch (error) {
            console.error('Error loading BMR data:', error);
            toast.error('Error loading BMR data: ' + error.message);
        }
    };

    // Load global templates
    const loadGlobalTemplates = async () => {
        try {
            const { data: templatesData, error: templatesError } = await supabase
                .from('global_templates')
                .select('*')
                .or(`department.eq.${activeProductionDepartment},department.is.null,is_public.eq.true`)
                .order('created_at', { ascending: false });

            if (!templatesError && templatesData) {
                setGlobalTemplates(templatesData);
            }
        } catch (error) {
            console.error('Error loading global templates:', error);
        }
    };

    // View Global Template Data
    const viewGlobalTemplate = (template) => {
        setSelectedGlobalTemplate(template);
        setShowViewGlobalTemplateModal(true);
    };

    // Add new global template
    const addGlobalTemplate = async () => {
        try {
            if (!newGlobalTemplate.name.trim()) {
                toast.error('Please enter template name!');
                return;
            }

            if (!newGlobalTemplate.template_data || newGlobalTemplate.template_data.length === 0) {
                toast.error('Please add template data!');
                return;
            }

            const templateToAdd = {
                name: newGlobalTemplate.name.trim(),
                description: newGlobalTemplate.description.trim(),
                category: newGlobalTemplate.category.trim(),
                template_data: newGlobalTemplate.template_data,
                department: activeProductionDepartment,
                is_public: newGlobalTemplate.is_public,
                created_by: 'System'
            };

            const { data, error } = await supabase
                .from('global_templates')
                .insert([templateToAdd])
                .select();

            if (error) throw error;

            setGlobalTemplates(prev => [...prev, data[0]]);
            toast.success('Global template added successfully!');
            setNewGlobalTemplate({
                name: "",
                description: "",
                category: "",
                template_data: [],
                is_public: true
            });
            setShowGlobalTemplateModal(false);
        } catch (error) {
            toast.error('Error adding global template: ' + error.message);
        }
    };

    // Update existing global template
    const updateGlobalTemplate = async () => {
        try {
            if (!selectedExistingTemplate) {
                toast.error('Please select a template to update!');
                return;
            }

            if (!newGlobalTemplate.template_data || newGlobalTemplate.template_data.length === 0) {
                toast.error('Please add template data!');
                return;
            }

            const { error } = await supabase
                .from('global_templates')
                .update({
                    template_data: newGlobalTemplate.template_data,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedExistingTemplate.id);

            if (error) throw error;

            setGlobalTemplates(prev =>
                prev.map(template =>
                    template.id === selectedExistingTemplate.id
                        ? { ...template, template_data: newGlobalTemplate.template_data }
                        : template
                )
            );
            toast.success('Global template updated successfully!');
            setNewGlobalTemplate({
                name: "",
                description: "",
                category: "",
                template_data: [],
                is_public: true
            });
            setSelectedExistingTemplate(null);
            setGlobalTemplateAction("new");
            setShowGlobalTemplateModal(false);
        } catch (error) {
            toast.error('Error updating global template: ' + error.message);
        }
    };

    // Load global template into current BMR
    const loadGlobalTemplate = async (template) => {
        if (!selectedBMR) {
            toast.error('Please select a BMR first!');
            return;
        }

        try {
            await updateTemplateDataInSupabase(selectedBMR.id, template.template_data);

            setSelectedBMR(prev => ({
                ...prev,
                templateData: template.template_data
            }));

            setBmrProducts(prev =>
                prev.map(product =>
                    product.id === selectedProduct.id
                        ? {
                            ...product,
                            assemblies: product.assemblies.map(assembly =>
                                assembly.id === selectedMainAssembly.id
                                    ? {
                                        ...assembly,
                                        bmrs: assembly.bmrs.map(bmr =>
                                            bmr.id === selectedBMR.id
                                                ? { ...bmr, templateData: template.template_data }
                                                : bmr
                                        )
                                    }
                                    : assembly
                            )
                        }
                        : product
                )
            );

            toast.success('Global template loaded successfully!');
            setSelectedGlobalTemplate(null);
            setShowViewGlobalTemplateModal(false);
        } catch (error) {
            toast.error('Error loading global template: ' + error.message);
        }
    };

    // Delete global template
    const deleteGlobalTemplate = async (templateId) => {
        showConfirmation({
            title: "Delete Global Template",
            message: "Are you sure you want to delete this global template? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('global_templates')
                        .delete()
                        .eq('id', templateId);

                    if (error) throw error;

                    setGlobalTemplates(prev => prev.filter(template => template.id !== templateId));
                    toast.success('Global template deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting global template: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Save to existing global template
    const saveToExistingTemplate = async () => {
        if (!selectedExistingTemplate) {
            toast.error('Please select an existing template!');
            return;
        }

        try {
            await updateGlobalTemplate();
        } catch (error) {
            toast.error('Error saving to existing template: ' + error.message);
        }
    };

    // Load process templates
    const loadProcessTemplates = async () => {
        try {
            const { data: templatesData, error: templatesError } = await supabase
                .from('process_templates')
                .select('*')
                .eq('department', activeProductionDepartment)
                .order('created_at', { ascending: false });

            if (!templatesError && templatesData) {
                setProcessTemplates(templatesData);
            }
        } catch (error) {
            console.error('Error loading process templates:', error);
        }
    };

    // Add new process template
    const addProcessTemplate = async () => {
        try {
            if (!newProcessTemplate.handler_name.trim() || !newProcessTemplate.amount) {
                toast.error('Please fill handler name and amount!');
                return;
            }

            const { data, error } = await supabase
                .from('process_templates')
                .insert([{
                    handler_name: newProcessTemplate.handler_name.trim(),
                    amount: parseFloat(newProcessTemplate.amount) || 0,
                    department: activeProductionDepartment
                }])
                .select();

            if (error) throw error;

            setProcessTemplates(prev => [...prev, data[0]]);
            toast.success('Process template added successfully!');
            setNewProcessTemplate({ handler_name: "", amount: "" });
            setShowProcessTemplateModal(false);
        } catch (error) {
            toast.error('Error adding process template: ' + error.message);
        }
    };

    // Delete process template
    const deleteProcessTemplate = async (templateId) => {
        showConfirmation({
            title: "Delete Process Template",
            message: "Are you sure you want to delete this process template?",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('process_templates')
                        .delete()
                        .eq('id', templateId);

                    if (error) throw error;

                    setProcessTemplates(prev => prev.filter(template => template.id !== templateId));
                    toast.success('Process template deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting process template: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Load processes with decimal support
    const loadProcesses = async () => {
        try {
            const { data: processesData, error: processesError } = await supabase
                .from('processes')
                .select('*')
                .eq('department', activeProductionDepartment)
                .order('created_at', { ascending: false });

            if (!processesError && processesData) {
                const processesWithTimers = processesData.map(process => {
                    let elapsedTime = process.elapsed_time || 0;
                    
                    // Parse handlers if it's a JSON string
                    let handlers = [];
                    if (process.handlers) {
                        try {
                            handlers = typeof process.handlers === 'string' 
                                ? JSON.parse(process.handlers) 
                                : process.handlers;
                            
                            // Ensure elapsedTime is preserved for handlers
                            handlers = handlers.map(handler => ({
                                ...handler,
                                elapsedTime: handler.elapsedTime || 0,
                                startTime: handler.startTime || null,
                                pauseTime: handler.pauseTime || null
                            }));
                        } catch (e) {
                            console.error('Error parsing handlers:', e);
                        }
                    }
                    
                    if (process.is_timer_running && process.start_time) {
                        elapsedTime += (Date.now() - new Date(process.start_time).getTime());
                    }
                    
                    return {
                        ...process,
                        elapsedTime: elapsedTime,
                        isTimerRunning: process.is_timer_running,
                        handlers: handlers,
                        startTime: process.start_time,
                        pauseTime: process.pause_time
                    };
                });
                
                setProcesses(processesWithTimers);

                const runningTimers = {};
                const timerStartTimes = {};
                const currentElapsedTimes = {};
                
                processesWithTimers.forEach(process => {
                    if (process.is_timer_running) {
                        runningTimers[process.id] = true;
                        timerStartTimes[process.id] = Date.now() - (process.elapsed_time || 0);
                        currentElapsedTimes[process.id] = process.elapsed_time || 0;
                    }
                });
                
                setActiveTimers(runningTimers);
                setTimerStarts(timerStartTimes);
                setElapsedTimes(currentElapsedTimes);
            }
        } catch (error) {
            console.error('Error loading processes:', error);
        }
    };

    // Load BMR History
    const loadBMRHistory = async () => {
        try {
            const { data: historyData, error: historyError } = await supabase
                .from('bmr_history')
                .select('*')
                .eq('department', activeProductionDepartment)
                .order('created_at', { ascending: false });

            if (!historyError && historyData) {
                setBmrHistory(historyData);
            }
        } catch (error) {
            console.error('Error loading BMR history:', error);
        }
    };

    // Filtered history based on assembly type and search term
    const getFilteredHistory = () => {
        let filtered = bmrHistory;

        if (historyFilter.assemblyType !== 'all') {
            filtered = filtered.filter(item => {
                const processesData = item.processes_data || [];
                return processesData.some(process => 
                    process.type === historyFilter.assemblyType
                );
            });
        }

        if (historyFilter.searchTerm.trim() !== '') {
            const searchTerm = historyFilter.searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                item.bmr_name.toLowerCase().includes(searchTerm) ||
                item.initial_code.toLowerCase().includes(searchTerm) ||
                item.product_name.toLowerCase().includes(searchTerm) ||
                item.assembly_name.toLowerCase().includes(searchTerm)
            );
        }

        return filtered;
    };

    // Load saved templates from localStorage
    const loadSavedTemplates = () => {
        try {
            const savedTemplatesData = localStorage.getItem('bmrSavedTemplates');
            if (savedTemplatesData) {
                setSavedTemplates(JSON.parse(savedTemplatesData));
            }
        } catch (error) {
            console.error('Error loading saved templates:', error);
        }
    };

    // Save templates to localStorage
    const saveTemplatesToStorage = (templates) => {
        try {
            localStorage.setItem('bmrSavedTemplates', JSON.stringify(templates));
        } catch (error) {
            console.error('Error saving templates:', error);
            toast.error('Error saving templates');
        }
    };

    // Timer effect for multiple timers
    useEffect(() => {
        const intervals = {};
        
        Object.keys(activeTimers).forEach(processId => {
            if (activeTimers[processId]) {
                intervals[processId] = setInterval(() => {
                    setElapsedTimes(prev => ({
                        ...prev,
                        [processId]: Date.now() - timerStarts[processId]
                    }));
                }, 1000);
            }
        });

        return () => {
            Object.values(intervals).forEach(interval => clearInterval(interval));
        };
    }, [activeTimers, timerStarts]);

    // Handler Timer effect
    useEffect(() => {
        const intervals = {};
        
        Object.keys(activeHandlerTimers).forEach(handlerId => {
            if (activeHandlerTimers[handlerId]) {
                intervals[handlerId] = setInterval(() => {
                    setHandlerElapsedTimes(prev => ({
                        ...prev,
                        [handlerId]: Date.now() - handlerTimerStarts[handlerId]
                    }));
                }, 1000);
            }
        });

        return () => {
            Object.values(intervals).forEach(interval => clearInterval(interval));
        };
    }, [activeHandlerTimers, handlerTimerStarts]);

    // Get page title based on active production department
    const getPageTitle = () => {
        if (activeProductionDepartment) {
            return `${activeProductionDepartment} - BATCH MANUFACTURING RECORD`;
        }
        return "Please select a production department first";
    };

    // Add new product to Supabase WITH DEPARTMENT
    const addNewProduct = async () => {
        if (!activeProductionDepartment) {
            toast.error('Please select a production department first!');
            return;
        }

        try {
            if (newProductName.trim()) {
                const { data: departmentData, error: deptError } = await supabase
                    .from('production_departments')
                    .select('has_assembly')
                    .eq('name', activeProductionDepartment)
                    .single();

                if (deptError) {
                    console.error('Error fetching department data:', deptError);
                    var hasAssembly = true;
                } else {
                    hasAssembly = departmentData?.has_assembly ?? true;
                }

                const { data, error } = await supabase
                    .from('bmr_products')
                    .insert([{ 
                        name: newProductName.trim(),
                        department: activeProductionDepartment,
                        has_assembly: hasAssembly
                    }])
                    .select();

                if (error) throw error;

                setBmrProducts(prev => [...prev, {
                    id: data[0].id,
                    name: data[0].name,
                    department: data[0].department,
                    hasAssembly: data[0].has_assembly,
                    assemblies: []
                }]);
                setNewProductName("");
                toast.success('New product added successfully!');
            }
        } catch (error) {
            toast.error('Error adding product: ' + error.message);
        }
    };

    // Edit product name in Supabase
    const startEditProduct = (product) => {
        setEditingProduct(product);
        setNewProductName(product.name);
    };

    const saveEditProduct = async () => {
        try {
            if (editingProduct && newProductName.trim()) {
                const { error } = await supabase
                    .from('bmr_products')
                    .update({ name: newProductName.trim() })
                    .eq('id', editingProduct.id);

                if (error) throw error;

                setBmrProducts(prev =>
                    prev.map(p =>
                        p.id === editingProduct.id
                            ? { ...p, name: newProductName.trim() }
                            : p
                    )
                );
                toast.success('Product name updated successfully!');
                setEditingProduct(null);
                setNewProductName("");
            }
        } catch (error) {
            toast.error('Error updating product: ' + error.message);
        }
    };

    // Delete product from Supabase
    const deleteProduct = async (productId) => {
        showConfirmation({
            title: "Delete Product",
            message: "Are you sure you want to delete this product? This will also delete all associated assemblies and BMRs.",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { data: assemblies, error: assembliesError } = await supabase
                        .from('bmr_assemblies')
                        .select('id')
                        .eq('product_id', productId);

                    if (assembliesError) throw assembliesError;

                    if (assemblies && assemblies.length > 0) {
                        const assemblyIds = assemblies.map(assembly => assembly.id);

                        const { error: templateDataError } = await supabase
                            .from('bmr_template_data')
                            .delete()
                            .in('template_id', 
                                (await supabase.from('bmr_templates').select('id').in('assembly_id', assemblyIds)).data?.map(t => t.id) || []
                            );

                        if (templateDataError) throw templateDataError;

                        const { error: templatesError } = await supabase
                            .from('bmr_templates')
                            .delete()
                            .in('assembly_id', assemblyIds);

                        if (templatesError) throw templatesError;

                        const { error: assembliesDeleteError } = await supabase
                            .from('bmr_assemblies')
                            .delete()
                            .eq('product_id', productId);

                        if (assembliesDeleteError) throw assembliesDeleteError;
                    }

                    const { error: productError } = await supabase
                        .from('bmr_products')
                        .delete()
                        .eq('id', productId);

                    if (productError) throw productError;

                    setBmrProducts(prev => prev.filter(p => p.id !== productId));
                    toast.success('Product deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting product: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Add assembly to product in Supabase - MODIFIED TO REMOVE RANDOM NUMBERS
    const addAssembly = async (productId, type) => {
        try {
            const product = bmrProducts.find(p => p.id === productId);
            if (!product) {
                toast.error('Product not found!');
                return;
            }

            let assemblyName = "";
            let assemblyType = type;
            
            if (!product.hasAssembly) {
                if (type === "main" || type === "sub") {
                    toast.error('This product only supports simple assemblies!');
                    return;
                }
                assemblyType = "assembly";
                assemblyName = "ASSEMBLY";
            } else {
                if (type === "main") {
                    assemblyName = "MAIN ASSEMBLY";
                } else if (type === "sub") {
                    assemblyName = "SUB ASSEMBLY"; // Removed random numbers
                } else {
                    assemblyName = "ASSEMBLY";
                }
            }
            
            const { data, error } = await supabase
                .from('bmr_assemblies')
                .insert([{
                    product_id: productId,
                    name: assemblyName,
                    type: assemblyType
                }])
                .select();

            if (error) throw error;

            setBmrProducts(prev =>
                prev.map(product =>
                    product.id === productId
                        ? {
                            ...product,
                            assemblies: [
                                ...product.assemblies,
                                {
                                    id: data[0].id,
                                    name: data[0].name,
                                    type: data[0].type,
                                    bmrs: []
                                }
                            ]
                        }
                        : product
                )
            );
            toast.success(`${type === "main" ? "Main" : type === "sub" ? "Sub" : ""} assembly added!`);
        } catch (error) {
            toast.error('Error adding assembly: ' + error.message);
        }
    };

    // Edit assembly name in Supabase
    const startEditAssembly = (assembly) => {
        setEditingAssembly(assembly);
        setNewAssemblyName(assembly.name);
    };

    const saveEditAssembly = async () => {
        try {
            if (editingAssembly && newAssemblyName.trim()) {
                const { error } = await supabase
                    .from('bmr_assemblies')
                    .update({ name: newAssemblyName.trim() })
                    .eq('id', editingAssembly.id);

                if (error) throw error;

                setBmrProducts(prev =>
                    prev.map(product => ({
                        ...product,
                        assemblies: product.assemblies.map(assembly =>
                            assembly.id === editingAssembly.id
                                ? { ...assembly, name: newAssemblyName.trim() }
                                : assembly
                        )
                    }))
                );
                toast.success('Assembly name updated successfully!');
                setEditingAssembly(null);
                setNewAssemblyName("");
            }
        } catch (error) {
            toast.error('Error updating assembly: ' + error.message);
        }
    };

    // Delete assembly from Supabase
    const deleteAssembly = async (productId, assemblyId) => {
        showConfirmation({
            title: "Delete Assembly",
            message: "Are you sure you want to delete this assembly? This will also delete all associated BMRs.",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error: templateDataError } = await supabase
                        .from('bmr_template_data')
                        .delete()
                        .in('template_id', 
                            (await supabase.from('bmr_templates').select('id').eq('assembly_id', assemblyId)).data?.map(t => t.id) || []
                        );

                    if (templateDataError) throw templateDataError;

                    const { error: templatesError } = await supabase
                        .from('bmr_templates')
                        .delete()
                        .eq('assembly_id', assemblyId);

                    if (templatesError) throw templatesError;

                    const { error: assemblyError } = await supabase
                        .from('bmr_assemblies')
                        .delete()
                        .eq('id', assemblyId);

                    if (assemblyError) throw assemblyError;

                    setBmrProducts(prev =>
                        prev.map(product =>
                            product.id === productId
                                ? {
                                    ...product,
                                    assemblies: product.assemblies.filter(a => a.id !== assemblyId)
                                }
                                : product
                        )
                    );
                    toast.success('Assembly deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting assembly: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Check if initial code is unique WITHIN DEPARTMENT
    const isInitialCodeUnique = async (initialCode, currentBmrId = null) => {
        let query = supabase
            .from('bmr_templates')
            .select('id')
            .eq('initial_code', initialCode)
            .eq('department', activeProductionDepartment);

        if (currentBmrId) {
            query = query.neq('id', currentBmrId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data.length === 0;
    };

    // Add BMR
    const addBMR = async (productId, assemblyId = null) => {
        try {
            if (!newBMR.name.trim()) {
                toast.error('Please enter BMR name!');
                return;
            }

            if (!newBMR.initialCode.trim()) {
                toast.error('Please enter initial code!');
                return;
            }

            const isUnique = await isInitialCodeUnique(newBMR.initialCode);
            if (!isUnique) {
                toast.error('Initial code must be unique within this department!');
                return;
            }

            const product = bmrProducts.find(p => p.id === productId);
            let bmrType = newBMR.type;
            
            if (product && !product.hasAssembly) {
                bmrType = "assembly";
            }

            const bmrData = {
                name: newBMR.name,
                type: bmrType,
                initial_code: newBMR.initialCode,
                status: newBMR.status,
                department: activeProductionDepartment,
                assembly_id: assemblyId
            };

            const { data, error } = await supabase
                .from('bmr_templates')
                .insert([bmrData])
                .select();

            if (error) throw error;

            const newBmrData = data[0];
            const bmrToAdd = {
                id: newBmrData.id,
                name: newBmrData.name,
                type: newBmrData.type,
                initialCode: newBmrData.initial_code,
                status: newBmrData.status,
                department: newBmrData.department,
                templateData: []
            };

            setBmrProducts(prev =>
                prev.map(product =>
                    product.id === productId
                        ? {
                            ...product,
                            assemblies: product.assemblies.map(assembly =>
                                assembly.id === assemblyId
                                    ? {
                                        ...assembly,
                                        bmrs: [...assembly.bmrs, bmrToAdd]
                                    }
                                    : assembly
                            )
                        }
                        : product
                )
            );

            setBmrTemplates(prev => [...prev, bmrToAdd]);

            setNewBMR({
                name: "",
                type: "assembly",
                initialCode: "",
                status: "active"
            });
            toast.success('BMR added successfully!');
        } catch (error) {
            console.error('BMR creation error:', error);
            toast.error('Error adding BMR: ' + error.message);
        }
    };

    // Edit BMR in Supabase
    const startEditBMR = (bmr, productId, assemblyId) => {
        setNewBMR({
            name: bmr.name,
            type: bmr.type,
            initialCode: bmr.initialCode,
            status: bmr.status
        });
        setEditingBMR({ ...bmr, productId, assemblyId });
    };

    const saveEditBMR = async () => {
        try {
            if (editingBMR && newBMR.name.trim() && newBMR.initialCode.trim()) {
                const isUnique = await isInitialCodeUnique(newBMR.initialCode, editingBMR.id);
                if (!isUnique) {
                    toast.error('Initial code must be unique within this department!');
                    return;
                }

                const product = bmrProducts.find(p => p.id === editingBMR.productId);
                if (product && !product.hasAssembly && (newBMR.type === "main" || newBMR.type === "sub")) {
                    toast.error('Simple assembly products cannot have Main or Sub BMR types!');
                    return;
                }

                const { error } = await supabase
                    .from('bmr_templates')
                    .update({
                        name: newBMR.name,
                        type: newBMR.type,
                        initial_code: newBMR.initialCode,
                        status: newBMR.status
                    })
                    .eq('id', editingBMR.id);

                if (error) throw error;

                setBmrProducts(prev =>
                    prev.map(product =>
                        product.id === editingBMR.productId
                            ? {
                                ...product,
                                assemblies: product.assemblies.map(assembly =>
                                    assembly.id === editingBMR.assemblyId
                                        ? {
                                            ...assembly,
                                            bmrs: assembly.bmrs.map(bmr =>
                                                bmr.id === editingBMR.id
                                                    ? { ...bmr, ...newBMR }
                                                    : bmr
                                            )
                                        }
                                        : assembly
                                )
                            }
                            : product
                        )
                );

                setBmrTemplates(prev =>
                    prev.map(bmr =>
                        bmr.id === editingBMR.id
                            ? { ...bmr, ...newBMR }
                            : bmr
                    )
                );

                toast.success('BMR updated successfully!');
                setEditingBMR(null);
                setNewBMR({
                    name: "",
                    type: "assembly",
                    initialCode: "",
                    status: "active"
                });
            }
        } catch (error) {
            toast.error('Error updating BMR: ' + error.message);
        }
    };

    // Delete BMR from Supabase
    const deleteBMR = async (bmrId, productId, assemblyId) => {
        showConfirmation({
            title: "Delete BMR",
            message: "Are you sure you want to delete this BMR? This will also delete all template data and processes.",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error: templateDataError } = await supabase
                        .from('bmr_template_data')
                        .delete()
                        .eq('template_id', bmrId);

                    if (templateDataError) throw templateDataError;

                    const { error: processesError } = await supabase
                        .from('processes')
                        .delete()
                        .eq('template_id', bmrId);

                    if (processesError) throw processesError;

                    const { error: bmrError } = await supabase
                        .from('bmr_templates')
                        .delete()
                        .eq('id', bmrId);

                    if (bmrError) throw bmrError;

                    setBmrProducts(prev =>
                        prev.map(product =>
                            product.id === productId
                                ? {
                                    ...product,
                                    assemblies: product.assemblies.map(assembly =>
                                        assembly.id === assemblyId
                                            ? {
                                                ...assembly,
                                                bmrs: assembly.bmrs.filter(bmr => bmr.id !== bmrId)
                                            }
                                            : assembly
                                    )
                                }
                                : product
                            )
                    );

                    setBmrTemplates(prev => prev.filter(bmr => bmr.id !== bmrId));

                    const updatedTemplates = { ...savedTemplates };
                    delete updatedTemplates[bmrId];
                    setSavedTemplates(updatedTemplates);
                    saveTemplatesToStorage(updatedTemplates);

                    toast.success('BMR deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting BMR: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Update BMR status in Supabase
    const updateBMRStatus = async (bmrId, newStatus, productId, assemblyId) => {
        try {
            const { error } = await supabase
                .from('bmr_templates')
                .update({ status: newStatus })
                .eq('id', bmrId);

            if (error) throw error;

            setBmrProducts(prev =>
                prev.map(product =>
                    product.id === productId
                        ? {
                            ...product,
                            assemblies: product.assemblies.map(assembly =>
                                assembly.id === assemblyId
                                    ? {
                                        ...assembly,
                                        bmrs: assembly.bmrs.map(bmr =>
                                            bmr.id === bmrId
                                                ? { ...bmr, status: newStatus }
                                                : bmr
                                        )
                                    }
                                    : assembly
                            )
                        }
                        : product
                    )
            );

            setBmrTemplates(prev =>
                prev.map(bmr =>
                    bmr.id === bmrId
                        ? { ...bmr, status: newStatus }
                        : bmr
                )
            );

            toast.success(`BMR status updated to ${newStatus}`);
        } catch (error) {
            toast.error('Error updating BMR status: ' + error.message);
        }
    };

    // Function to find product by variant barcode
    const findProductByVariantBarcode = async (barcode) => {
        try {
            // First try to find in stock_variants
            const { data: variant, error: variantError } = await supabase
                .from('stock_variants')
                .select(`
                    *,
                    stocks (
                        id,
                        part_no,
                        name,
                        price,
                        average_price
                    )
                `)
                .eq('bare_code', barcode)
                .single();

            if (!variantError && variant) {
                return {
                    type: 'variant',
                    data: variant,
                    stock: variant.stocks,
                    price: variant.price || variant.stocks?.price || 0
                };
            }

            // If not found in variants, try stocks
            const { data: stock, error: stockError } = await supabase
                .from('stocks')
                .select('*')
                .eq('bare_code', barcode)
                .single();

            if (!stockError && stock) {
                return {
                    type: 'stock',
                    data: stock,
                    stock: stock,
                    price: stock.price || 0
                };
            }

            return null;
        } catch (error) {
            console.error('Error finding product by barcode:', error);
            return null;
        }
    };

    // Add product to BMR template in Supabase (accepting variants) with decimal support
    const addProductToBMRTemplate = async (bmrId, productId, assemblyId) => {
        try {
            const newProductEntry = {
                raw_material: "",
                part_no: "",
                internal_serial_no: "",
                description: "",
                assembly_name: "",
                quantity: 1.00,
                price: 0,
                issued_by: "",
                received_by: "",
                variant_details: null,
                total_quantity: 1.00,
                average_price: 0
            };

            const { data, error } = await supabase
                .from('bmr_template_data')
                .insert([{
                    ...newProductEntry,
                    template_id: bmrId
                }])
                .select();

            if (error) throw error;

            const newTemplateData = {
                ...data[0],
                rawMaterial: data[0].raw_material,
                partNo: data[0].part_no,
                internalSerialNo: data[0].internal_serial_no,
                description: data[0].description,
                assemblyName: data[0].assembly_name,
                quantity: parseFloat(data[0].quantity) || 1.00,
                price: parseFloat(data[0].price) || 0,
                issuedBy: data[0].issued_by,
                receivedBy: data[0].received_by,
                variantDetails: data[0].variant_details,
                totalQuantity: parseFloat(data[0].total_quantity) || 1.00,
                averagePrice: parseFloat(data[0].average_price) || 0
            };

            setBmrProducts(prev =>
                prev.map(product =>
                    product.id === productId
                        ? {
                            ...product,
                            assemblies: product.assemblies.map(assembly =>
                                assembly.id === assemblyId
                                    ? {
                                        ...assembly,
                                        bmrs: assembly.bmrs.map(bmr =>
                                            bmr.id === bmrId
                                                ? {
                                                    ...bmr,
                                                    templateData: [...(bmr.templateData || []), newTemplateData]
                                                }
                                                : bmr
                                        )
                                    }
                                    : assembly
                            )
                        }
                        : product
                    )
            );

            if (selectedBMR && selectedBMR.id === bmrId) {
                setSelectedBMR(prev => ({
                    ...prev,
                    templateData: [...(prev.templateData || []), newTemplateData]
                }));
            }

            toast.success('Product added to BMR template!');
        } catch (error) {
            toast.error('Error adding product to template: ' + error.message);
        }
    };

    // Update BMR template product data in Supabase with decimal support
    const updateBMRTemplateProduct = async (bmrId, productIndex, field, value, productId, assemblyId) => {
        try {
            const currentProducts = bmrProducts.find(p => p.id === productId)
                ?.assemblies.find(a => a.id === assemblyId)
                ?.bmrs.find(b => b.id === bmrId)
                ?.templateData || [];

            const productToUpdate = currentProducts[productIndex];
            if (!productToUpdate) return;

            const supabaseFieldMap = {
                'rawMaterial': 'raw_material',
                'partNo': 'part_no',
                'internalSerialNo': 'internal_serial_no',
                'description': 'description',
                'assemblyName': 'assembly_name',
                'quantity': 'quantity',
                'price': 'price',
                'issuedBy': 'issued_by',
                'receivedBy': 'received_by',
                'variantDetails': 'variant_details',
                'totalQuantity': 'total_quantity',
                'averagePrice': 'average_price'
            };

            const supabaseField = supabaseFieldMap[field] || field;
            
            // Parse decimal values for quantity fields
            let parsedValue = value;
            if (field === 'quantity' || field === 'price' || field === 'totalQuantity' || field === 'averagePrice') {
                parsedValue = parseFloat(value) || 0;
            }

            const updateData = { [supabaseField]: parsedValue };

            const { error } = await supabase
                .from('bmr_template_data')
                .update(updateData)
                .eq('id', productToUpdate.id);

            if (error) throw error;

            // Update local state
            const updatedProduct = { ...productToUpdate, [field]: parsedValue };
            
            // Recalculate total price if quantity or price changed
            if (field === 'quantity' || field === 'price') {
                const totalPrice = (parseFloat(updatedProduct.quantity) || 0) * (parseFloat(updatedProduct.price) || 0);
                // Don't update total price field as it's calculated on the fly
            }

            setBmrProducts(prev =>
                prev.map(product =>
                    product.id === productId
                        ? {
                            ...product,
                            assemblies: product.assemblies.map(assembly =>
                                assembly.id === assemblyId
                                    ? {
                                        ...assembly,
                                        bmrs: assembly.bmrs.map(bmr =>
                                            bmr.id === bmrId
                                                ? {
                                                    ...bmr,
                                                    templateData: bmr.templateData.map((product, idx) =>
                                                        idx === productIndex
                                                            ? updatedProduct
                                                            : product
                                                    )
                                                }
                                                : bmr
                                        )
                                    }
                                    : assembly
                            )
                        }
                        : product
                    )
            );

            if (selectedBMR && selectedBMR.id === bmrId) {
                setSelectedBMR(prev => ({
                    ...prev,
                    templateData: prev.templateData.map((product, idx) =>
                        idx === productIndex
                            ? updatedProduct
                            : product
                    )
                }));
            }
        } catch (error) {
            toast.error('Error updating template product: ' + error.message);
        }
    };

    // Print BMR Template with decimal support (UPDATED VERSION)
    const printBMRTemplate = (bmr, includeProcesses = true) => {
        const printWindow = window.open('', '_blank');
        const templateData = bmr.templateData || [];
        const bmrProcesses = includeProcesses ? getBMRProcesses(bmr.id) : [];
        
        // Calculate totals with decimal support
        const templateTotal = templateData.reduce((sum, item) => {
            return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
        }, 0);
        
        const processTotal = bmrProcesses.reduce((sum, process) => {
            let processCost = 0;
            if (process.handlers && process.handlers.length > 0) {
                processCost = process.handlers.reduce((hSum, handler) => 
                    hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
            } else {
                processCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
            }
            return sum + processCost;
        }, 0);
        
        const grandTotal = templateTotal + processTotal;
        
        const printContent = `
            <html>
                <head>
                    <title>BMR - ${bmr.name}</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            margin: 0; 
                            padding: 20px; 
                            font-size: 12px; 
                            color: #333;
                            background-color: #fff;
                        }
                        .print-header { 
                            text-align: center; 
                            margin-bottom: 25px; 
                            padding-bottom: 15px; 
                            border-bottom: 2px solid #2c3e50;
                        }
                        .print-header h2 { 
                            color: #2c3e50; 
                            margin: 0 0 5px 0;
                            font-size: 20px;
                            font-weight: 600;
                        }
                        .print-header h3 { 
                            color: #3498db; 
                            margin: 0 0 15px 0;
                            font-size: 16px;
                            font-weight: 500;
                        }
                        .print-info { 
                            display: flex; 
                            justify-content: space-between; 
                            margin-bottom: 20px;
                            font-size: 11px;
                        }
                        .print-table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-top: 15px;
                            font-size: 11px;
                        }
                        .print-table th, .print-table td { 
                            border: 1px solid #ddd; 
                            padding: 6px; 
                            text-align: left;
                            vertical-align: top;
                        }
                        .print-table th { 
                            background-color: #f8f9fa; 
                            font-weight: 600;
                            color: #2c3e50;
                        }
                        .print-table tr:nth-child(even) {
                            background-color: #f8f9fa;
                        }
                        .print-summary { 
                            margin-top: 20px; 
                            padding: 15px; 
                            border: 1px solid #ddd;
                            background-color: #f8f9fa;
                            border-radius: 4px;
                        }
                        .print-total { 
                            margin: 8px 0;
                            font-weight: 500;
                        }
                        .print-grand-total { 
                            font-weight: 700; 
                            font-size: 14px;
                            color: #27ae60;
                            margin-top: 15px;
                            padding-top: 15px;
                            border-top: 2px solid #ddd;
                        }
                        @media print {
                            body { 
                                padding: 10px; 
                                margin: 0;
                            }
                            .print-table th { 
                                background-color: #f8f9fa !important;
                                -webkit-print-color-adjust: exact;
                            }
                            .print-table tr:nth-child(even) {
                                background-color: #f8f9fa !important;
                                -webkit-print-color-adjust: exact;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <h2>BATCH MANUFACTURING RECORD</h2>
                        <h3>${bmr.name} - ${bmr.initialCode}</h3>
                        <div class="print-info">
                            <div><strong>Department:</strong> ${activeProductionDepartment}</div>
                            <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
                            <div><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
                        </div>
                    </div>
                    
                    ${templateData.length > 0 ? `
                        <h4 style="color: #2c3e50; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px;">MATERIALS REQUIRED</h4>
                        <table class="print-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Raw Material / Description</th>
                                    <th>Part No</th>
                                    <th>Internal Serial No</th>
                                    <th>Qty</th>
                                    <th>Price (₹)</th>
                                    <th>Total (₹)</th>
                                    <th>Issued By</th>
                                    <th>Received By</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${templateData.map((item, index) => {
                                    const total = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                                    
                                    return `
                                        <tr>
                                            <td style="text-align: center; width: 30px;">${index + 1}</td>
                                            <td>
                                                <div><strong>${item.rawMaterial || 'N/A'}</strong></div>
                                                <div style="font-size: 10px; color: #666;">${item.description || ''}</div>
                                            </td>
                                            <td>${item.partNo || 'N/A'}</td>
                                            <td>${item.internalSerialNo || 'N/A'}</td>
                                            <td style="text-align: center;">${parseFloat(item.quantity || 1).toFixed(2)}</td>
                                            <td style="text-align: right;">₹${parseFloat(item.price || 0).toFixed(2)}</td>
                                            <td style="text-align: right; font-weight: 600;">₹${total.toFixed(2)}</td>
                                            <td>${item.issuedBy || 'N/A'}</td>
                                            <td>${item.receivedBy || 'N/A'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="print-summary">
                            <div class="print-total">Total Items: ${templateData.length}</div>
                            <div class="print-total">Materials Total: ₹${templateTotal.toFixed(2)}</div>
                        </div>
                    ` : ''}
                    
                    ${includeProcesses && bmrProcesses.length > 0 ? `
                        <h4 style="color: #2c3e50; margin: 25px 0 10px 0; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px;">PROCESS DETAILS</h4>
                        <table class="print-table">
                            <thead>
                                <tr>
                                    <th>Process Name</th>
                                    <th>Total Time</th>
                                    <th>Total Cost (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bmrProcesses.map(process => {
                                    let totalCost = 0;
                                    if (process.handlers && process.handlers.length > 0) {
                                        totalCost = process.handlers.reduce((hSum, handler) => 
                                            hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                                    } else {
                                        totalCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                    }
                                    return `
                                        <tr>
                                            <td><strong>${process.name}</strong></td>
                                            <td>${formatTime(process.elapsedTime || 0)}</td>
                                            <td style="text-align: right; font-weight: 600;">₹${totalCost.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    ` : ''}

                    <div class="print-summary">
                        <div class="print-grand-total">GRAND TOTAL: ₹${grandTotal.toFixed(2)}</div>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center;">
                        <div>Generated by BMR System</div>
                        <div>Printed on: ${new Date().toLocaleString()}</div>
                    </div>
                    
                    <script>
                        // Auto-print and close after delay
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                                window.close();
                            }, 500);
                        }, 500);
                    </script>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    // Save to history before completion
    const saveBMRToHistory = async (bmr) => {
        try {
            const bmrProcesses = getBMRProcesses(bmr.id).map(process => ({
                ...process,
                handlers: process.handlers || []
            }));

            const historyData = {
                template_id: bmr.id,
                product_name: selectedProduct?.name || 'Direct BMR',
                assembly_name: selectedMainAssembly?.name || 'No Assembly',
                bmr_name: bmr.name,
                initial_code: bmr.initialCode,
                department: activeProductionDepartment,
                template_data: bmr.templateData || [],
                processes_data: bmrProcesses,
                completed_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('bmr_history')
                .insert([historyData]);

            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error saving to history:', error);
            return false;
        }
    };

    // Save BMR Template Data
    const saveBMRTemplate = (bmrId, productId, assemblyId) => {
        const product = bmrProducts.find(p => p.id === productId);
        const assembly = product?.assemblies.find(a => a.id === assemblyId);
        const bmr = assembly?.bmrs.find(b => b.id === bmrId);

        if (!bmr) {
            toast.error('BMR not found!');
            return;
        }

        const templateToSave = {
            ...bmr,
            savedAt: new Date().toISOString(),
            productId: productId,
            assemblyId: assemblyId,
            productName: product?.name || 'Unknown Product',
            assemblyName: assembly?.name || 'Unknown Assembly',
            department: activeProductionDepartment,
            templateData: bmr.templateData || []
        };

        const updatedTemplates = {
            ...savedTemplates,
            [bmrId]: templateToSave
        };

        setSavedTemplates(updatedTemplates);
        saveTemplatesToStorage(updatedTemplates);

        toast.success('BMR template saved successfully!');
    };

    // View Saved Template for specific BMR
    const viewSavedTemplate = (bmrId) => {
        const template = savedTemplates[bmrId];
        if (template) {
            setSelectedSavedTemplate(template);
        } else {
            toast.error('No saved template found for this BMR!');
        }
    };

    // Load Saved Template into Current BMR
    const loadSavedTemplate = (template) => {
        if (!selectedBMR) {
            toast.error('Please select a BMR first!');
            return;
        }

        setSelectedBMR(prev => ({
            ...prev,
            templateData: template.templateData || []
        }));

        setBmrProducts(prev =>
            prev.map(product =>
                product.id === selectedProduct.id
                    ? {
                        ...product,
                        assemblies: product.assemblies.map(assembly =>
                            assembly.id === selectedMainAssembly.id
                                ? {
                                    ...assembly,
                                    bmrs: assembly.bmrs.map(bmr =>
                                        bmr.id === selectedBMR.id
                                            ? { ...bmr, templateData: template.templateData || [] }
                                            : bmr
                                    )
                                }
                                : assembly
                        )
                    }
                    : product
                )
        );

        updateTemplateDataInSupabase(selectedBMR.id, template.templateData || []);

        setSelectedSavedTemplate(null);
        toast.success('Template loaded successfully!');
    };

    // Update template data in Supabase when loading a saved template
    const updateTemplateDataInSupabase = async (bmrId, templateData) => {
        try {
            const { error: deleteError } = await supabase
                .from('bmr_template_data')
                .delete()
                .eq('template_id', bmrId);

            if (deleteError) throw deleteError;

            if (templateData && templateData.length > 0) {
                const dataToInsert = templateData.map(item => ({
                    template_id: bmrId,
                    raw_material: item.rawMaterial || '',
                    part_no: item.partNo || '',
                    internal_serial_no: item.internalSerialNo || '',
                    description: item.description || '',
                    assembly_name: item.assemblyName || '',
                    quantity: parseFloat(item.quantity) || 1.00,
                    price: parseFloat(item.price) || 0,
                    issued_by: item.issuedBy || '',
                    received_by: item.receivedBy || '',
                    variant_details: item.variantDetails || null,
                    total_quantity: parseFloat(item.totalQuantity) || parseFloat(item.quantity) || 1.00,
                    average_price: parseFloat(item.averagePrice) || parseFloat(item.price) || 0
                }));

                const { error: insertError } = await supabase
                    .from('bmr_template_data')
                    .insert(dataToInsert);

                if (insertError) throw insertError;
            }
        } catch (error) {
            console.error('Error updating template data in Supabase:', error);
            toast.error('Error updating template data');
        }
    };

    // Delete Saved Template for specific BMR
    const deleteSavedTemplate = (bmrId) => {
        showConfirmation({
            title: "Delete Saved Template",
            message: "Are you sure you want to delete this saved template?",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: () => {
                const updatedTemplates = { ...savedTemplates };
                delete updatedTemplates[bmrId];
                setSavedTemplates(updatedTemplates);
                saveTemplatesToStorage(updatedTemplates);
                toast.success('Saved template deleted!');
            },
            onCancel: () => {}
        });
    };

    // Process Management Functions
    const openProcessModal = (bmr) => {
        setSelectedBMRForProcess(bmr);
        setShowProcessModal(true);
    };

    const closeProcessModal = () => {
        setShowProcessModal(false);
        setSelectedBMRForProcess(null);
    };

    const openAddProcessModal = () => {
        setNewProcess({
            name: "",
            amount: "0",
            handler: "",
            status: "initiate"
        });
        setShowAddProcessModal(true);
    };

    const closeAddProcessModal = () => {
        setShowAddProcessModal(false);
        setNewProcess({
            name: "",
            amount: "0",
            handler: "",
            status: "initiate"
        });
    };

    // Add new process to Supabase
    const addNewProcess = async () => {
        try {
            if (!newProcess.name.trim()) {
                toast.error('Please fill process name!');
                return;
            }

            const processToAdd = {
                template_id: selectedBMRForProcess.id,
                name: newProcess.name.trim(),
                amount: 0,
                handler: newProcess.handler,
                status: newProcess.status,
                elapsed_time: 0,
                is_timer_running: false,
                department: activeProductionDepartment
            };

            const { data, error } = await supabase
                .from('processes')
                .insert([processToAdd])
                .select();

            if (error) throw error;

            setProcesses(prev => [...prev, {
                ...data[0],
                elapsedTime: data[0].elapsed_time,
                isTimerRunning: data[0].is_timer_running,
                handlers: []
            }]);
            toast.success('New process added successfully!');
            closeAddProcessModal();
        } catch (error) {
            toast.error('Error adding process: ' + error.message);
        }
    };

    // Timer control functions
    const startTimer = async (processId) => {
        try {
            const now = new Date();
            const process = processes.find(p => p.id === processId);
            
            // If process was paused, calculate elapsed time from pause
            let elapsedTime = 0;
            if (process.elapsedTime) {
                elapsedTime = process.elapsedTime;
            } else if (process.elapsed_time) {
                elapsedTime = process.elapsed_time;
            }
            
            const { error } = await supabase
                .from('processes')
                .update({
                    status: 'inprogress',
                    start_time: now.toISOString(),
                    is_timer_running: true,
                    elapsed_time: elapsedTime
                })
                .eq('id', processId);

            if (error) throw error;

            setProcesses(prev =>
                prev.map(process =>
                    process.id === processId
                        ? {
                            ...process,
                            status: 'inprogress',
                            startTime: now.toISOString(),
                            isTimerRunning: true,
                            elapsedTime: elapsedTime
                        }
                        : process
                )
            );

            setActiveTimers(prev => ({ ...prev, [processId]: true }));
            setTimerStarts(prev => ({ ...prev, [processId]: Date.now() - elapsedTime }));
            setElapsedTimes(prev => ({ ...prev, [processId]: elapsedTime }));

        } catch (error) {
            toast.error('Error starting timer: ' + error.message);
        }
    };

    const pauseTimer = async (processId) => {
        try {
            const now = new Date();
            const currentElapsed = elapsedTimes[processId] || 0;

            const { error } = await supabase
                .from('processes')
                .update({
                    status: 'pending',
                    pause_time: now.toISOString(),
                    is_timer_running: false,
                    elapsed_time: currentElapsed
                })
                .eq('id', processId);

            if (error) throw error;

            setProcesses(prev =>
                prev.map(process =>
                    process.id === processId
                        ? {
                            ...process,
                            status: 'pending',
                            pauseTime: now.toISOString(),
                            isTimerRunning: false,
                            elapsedTime: currentElapsed
                        }
                        : process
                )
            );

            setActiveTimers(prev => ({ ...prev, [processId]: false }));
            setElapsedTimes(prev => ({ ...prev, [processId]: currentElapsed }));

        } catch (error) {
            toast.error('Error pausing timer: ' + error.message);
        }
    };

    const stopTimer = async (processId) => {
        try {
            const now = new Date();
            const currentElapsed = elapsedTimes[processId] || 0;
            const process = processes.find(p => p.id === processId);
            
            // Calculate total cost from handlers if multiple handlers exist
            let totalCost = 0;
            if (process.handlers && process.handlers.length > 0) {
                totalCost = process.handlers.reduce((sum, handler) => 
                    sum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
            } else {
                totalCost = (process?.amount || 0) * (currentElapsed / 60000);
            }

            const { error } = await supabase
                .from('processes')
                .update({
                    status: 'completed',
                    end_time: now.toISOString(),
                    is_timer_running: false,
                    elapsed_time: currentElapsed,
                    total_time: formatTime(currentElapsed),
                    total_cost: totalCost
                })
                .eq('id', processId);

            if (error) throw error;

            setProcesses(prev =>
                prev.map(process =>
                    process.id === processId
                        ? {
                            ...process,
                            status: 'completed',
                            endTime: now.toISOString(),
                            isTimerRunning: false,
                            elapsedTime: currentElapsed,
                            totalTime: formatTime(currentElapsed),
                            totalCost: totalCost.toFixed(2)
                        }
                        : process
                )
            );

            setActiveTimers(prev => ({ ...prev, [processId]: false }));
            setElapsedTimes(prev => ({ ...prev, [processId]: currentElapsed }));

        } catch (error) {
            toast.error('Error stopping timer: ' + error.message);
        }
    };

    const formatTime = (milliseconds) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const getCurrentTimer = (process) => {
        if (activeTimers[process.id]) {
            return elapsedTimes[process.id] || 0;
        }
        return process.elapsedTime || 0;
    };

    const calculateCost = (process) => {
        let totalMinutes = 0;
        if (process.handlers && process.handlers.length > 0) {
            totalMinutes = process.handlers.reduce((sum, handler) => 
                sum + ((handler.elapsedTime || 0) / 60000), 0);
        } else {
            totalMinutes = (getCurrentTimer(process) / 60000);
        }
        
        let totalCost = 0;
        if (process.handlers && process.handlers.length > 0) {
            totalCost = process.handlers.reduce((sum, handler) => 
                sum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
        } else {
            totalCost = (process.amount || 0) * totalMinutes;
        }
        
        return totalCost.toFixed(2);
    };

    // Get processes for a specific BMR
    const getBMRProcesses = (bmrId) => {
        return processes.filter(process => process.template_id === bmrId);
    };

    // Delete process from Supabase
    const deleteProcess = async (processId) => {
        showConfirmation({
            title: "Delete Process",
            message: "Are you sure you want to delete this process?",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('processes')
                        .delete()
                        .eq('id', processId);

                    if (error) throw error;

                    setProcesses(prev => prev.filter(p => p.id !== processId));
                    
                    setActiveTimers(prev => {
                        const newTimers = { ...prev };
                        delete newTimers[processId];
                        return newTimers;
                    });
                    setElapsedTimes(prev => {
                        const newElapsed = { ...prev };
                        delete newElapsed[processId];
                        return newElapsed;
                    });
                    
                    toast.success('Process deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting process: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Edit process in Supabase
    const startEditProcess = (process) => {
        setNewProcess({
            ...process,
            amount: process.amount.toString()
        });
        setShowAddProcessModal(true);
    };

    const updateProcess = async () => {
        try {
            if (!newProcess.name.trim()) {
                toast.error('Please fill process name!');
                return;
            }

            const { error } = await supabase
                .from('processes')
                .update({
                    name: newProcess.name.trim(),
                    amount: 0,
                    handler: newProcess.handler,
                    status: newProcess.status
                })
                .eq('id', newProcess.id);

            if (error) throw error;

            setProcesses(prev =>
                prev.map(process =>
                    process.id === newProcess.id
                        ? {
                            ...newProcess,
                            amount: 0
                        }
                        : process
                )
            );
            toast.success('Process updated successfully!');
            closeAddProcessModal();
        } catch (error) {
            toast.error('Error updating process: ' + error.message);
        }
    };

    // Check if all processes are completed
    const areAllProcessesCompleted = (bmrId) => {
        const bmrProcesses = getBMRProcesses(bmrId);
        return bmrProcesses.length > 0 && bmrProcesses.every(process => process.status === 'completed');
    };

    // Complete BMR and move to stock with variant reduction
    const completeBMR = (bmr) => {
        if (!areAllProcessesCompleted(bmr.id)) {
            toast.error('Please complete all processes before finishing BMR!');
            return;
        }
        
        // Calculate total price (template items + process costs)
        const templateTotal = bmr.templateData?.reduce((sum, item) => {
            return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
        }, 0) || 0;

        const processTotal = getBMRProcesses(bmr.id).reduce((sum, process) => {
            let processCost = 0;
            if (process.handlers && process.handlers.length > 0) {
                processCost = process.handlers.reduce((hSum, handler) => 
                    hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
            } else {
                processCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
            }
            return sum + processCost;
        }, 0);

        const totalPrice = templateTotal + processTotal;

        // Auto-fill completion form
        setNewCompletedProduct({
            BareCode: `BMR-${bmr.initialCode}-${Date.now().toString().slice(-4)}`,
            PartNo: bmr.name,
            LotNo: `LOT-${bmr.initialCode}`,
            SNo: `SN-${bmr.initialCode}`,
            name: `${bmr.name} (${bmr.initialCode})`,
            price: totalPrice.toFixed(2),
            Quantity: "1.00"
        });
        
        setCompletedBMR(bmr);
        setShowCompletionModal(true);
    };

    // Handle handler name change - auto-fill amount from template
    const handleHandlerNameChange = (handlerName) => {
        setNewProcess(prev => {
            const template = processTemplates.find(t => t.handler_name === handlerName);
            return {
                ...prev,
                handler: handlerName,
                amount: "0"
            };
        });
    };

    // Handle completion of BMR with decimal support
    const handleCompleteBMR = async () => {
        if (!completedBMR) return;

        showConfirmation({
            title: "Complete BMR",
            message: "Are you sure you want to complete this BMR? This will move the product to stock and mark the BMR as completed.",
            confirmText: "Complete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    // 1. Calculate total price (template + processes)
                    const templateTotal = completedBMR.templateData?.reduce((sum, item) => {
                        return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                    }, 0) || 0;

                    const processTotal = getBMRProcesses(completedBMR.id).reduce((sum, process) => {
                        let processCost = 0;
                        if (process.handlers && process.handlers.length > 0) {
                            processCost = process.handlers.reduce((hSum, handler) => 
                                hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                        } else {
                            processCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                        }
                        return sum + processCost;
                    }, 0);

                    const totalPrice = templateTotal + processTotal;

                    // 2. Save to history first
                    const historySaved = await saveBMRToHistory(completedBMR);
                    if (!historySaved) {
                        toast.error('Error saving BMR history');
                        return;
                    }

                    // 3. Print the BMR with processes
                    printBMRTemplate(completedBMR, true);

                    // 4. Release using_quantity from variants
                    for (const templateItem of completedBMR.templateData || []) {
                        if (templateItem.internalSerialNo) {
                            // Parse multiple barcodes if comma separated
                            const barcodes = templateItem.internalSerialNo.split(',').map(b => b.trim());
                            
                            // Parse variant details if available
                            let variantDetails = [];
                            if (templateItem.variantDetails) {
                                try {
                                    variantDetails = typeof templateItem.variantDetails === 'string' 
                                        ? JSON.parse(templateItem.variantDetails) 
                                        : templateItem.variantDetails;
                                } catch (e) {
                                    console.error('Error parsing variant details:', e);
                                }
                            }

                            const totalQuantityNeeded = parseFloat(templateItem.quantity) || 1.00;
                            
                            // Process each barcode
                            for (const barcode of barcodes) {
                                try {
                                    // Get variant by barcode
                                    const { data: variant, error: variantError } = await supabase
                                        .from('stock_variants')
                                        .select('*')
                                        .eq('bare_code', barcode)
                                        .single();

                                    if (!variantError && variant) {
                                        // Find variant details for this barcode
                                        const variantDetail = variantDetails.find(v => v.barcode === barcode);
                                        const allocatedQty = variantDetail ? parseFloat(variantDetail.qty) : parseFloat(totalQuantityNeeded / barcodes.length);
                                        
                                        if (allocatedQty > 0) {
                                            // Release using quantity
                                            const currentUsingQty = parseFloat(variant.using_quantity) || 0;
                                            const newUsingQty = Math.max(0, currentUsingQty - allocatedQty);
                                            
                                            await supabase
                                                .from('stock_variants')
                                                .update({
                                                    using_quantity: newUsingQty,
                                                    updated_at: new Date().toISOString()
                                                })
                                                .eq('id', variant.id);
                                            
                                            // Record consumption
                                            await supabase
                                                .from('stock_movements')
                                                .insert([{
                                                    variant_id: variant.id,
                                                    movement_type: 'out',
                                                    quantity: allocatedQty,
                                                    remaining_quantity: newUsingQty,
                                                    reference_type: 'bmr_completion',
                                                    reference_id: completedBMR.id,
                                                    movement_date: new Date().toISOString()
                                                }]);
                                            
                                            // Update stock totals
                                            const { data: stockData, error: stockError } = await supabase
                                                .from('stocks')
                                                .select('using_quantity')
                                                .eq('id', variant.stock_id)
                                                .single();

                                            if (!stockError) {
                                                const stockUsingQty = parseFloat(stockData.using_quantity) || 0;
                                                const newStockUsingQty = Math.max(0, stockUsingQty - allocatedQty);
                                                
                                                await supabase
                                                    .from('stocks')
                                                    .update({
                                                        using_quantity: newStockUsingQty,
                                                        updated_at: new Date().toISOString()
                                                    })
                                                    .eq('id', variant.stock_id);
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.error(`Error processing variant ${barcode}:`, error);
                                }
                            }
                        }
                    }

                    // 5. Add completed product to stock with decimal support
                    const completedProduct = {
                        bare_code: newCompletedProduct.BareCode,
                        part_no: newCompletedProduct.PartNo,
                        lot_no: newCompletedProduct.LotNo,
                        s_no: newCompletedProduct.SNo,
                        name: newCompletedProduct.name,
                        price: parseFloat(totalPrice) || 0,
                        quantity: parseFloat(newCompletedProduct.Quantity) || 1.00,
                        using_quantity: 0,
                        average_price: parseFloat(totalPrice) || 0,
                        total_received: parseFloat(newCompletedProduct.Quantity) || 1.00
                    };

                    // Check if completed product already exists in stock
                    const { data: existingStockByBarcode, error: barcodeError } = await supabase
                        .from('stocks')
                        .select('*')
                        .eq('bare_code', completedProduct.bare_code)
                        .single();

                    const { data: existingStockByPartNo, error: partNoError } = await supabase
                        .from('stocks')
                        .select('*')
                        .eq('part_no', completedProduct.part_no)
                        .single();

                    let existingStock = existingStockByBarcode || existingStockByPartNo;
                    let stockOperation;

                    if (existingStock) {
                        // Product exists, update quantity with decimal support
                        const newQuantity = parseFloat(existingStock.quantity) + parseFloat(completedProduct.quantity);
                        const newTotalReceived = parseFloat(existingStock.total_received || 0) + parseFloat(completedProduct.quantity);
                        
                        // Calculate new average price
                        const totalExistingValue = parseFloat(existingStock.quantity) * parseFloat(existingStock.average_price || existingStock.price || 0);
                        const newItemValue = parseFloat(completedProduct.quantity) * parseFloat(completedProduct.price);
                        const newAveragePrice = newQuantity > 0 ? 
                            (totalExistingValue + newItemValue) / newQuantity : 0;
                        
                        stockOperation = supabase
                            .from('stocks')
                            .update({
                                quantity: newQuantity,
                                total_received: newTotalReceived,
                                average_price: newAveragePrice,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingStock.id);
                        
                        toast.success('Product quantity updated in stock!');
                    } else {
                        // Product doesn't exist, insert new
                        completedProduct.average_price = parseFloat(completedProduct.price);
                        completedProduct.total_received = parseFloat(completedProduct.quantity);
                        
                        stockOperation = supabase
                            .from('stocks')
                            .insert([completedProduct])
                            .select();
                        
                        toast.success('New product added to stock!');
                    }

                    // Execute stock operation
                    if (stockOperation) {
                        const { data: stockResult, error: stockOpError } = await stockOperation;
                        if (stockOpError) throw stockOpError;
                        
                        // Also create a variant for the new product
                        if (!existingStock) {
                            await supabase
                                .from('stock_variants')
                                .insert([{
                                    stock_id: stockResult[0].id,
                                    bare_code: completedProduct.bare_code,
                                    serial_no: completedProduct.s_no,
                                    lot_no: completedProduct.lot_no,
                                    batch_no: completedProduct.lot_no || `BATCH-${Date.now()}`,
                                    price: parseFloat(completedProduct.price),
                                    quantity: parseFloat(completedProduct.quantity),
                                    pending_testing: 0,
                                    using_quantity: 0,
                                    received_date: new Date().toISOString().split('T')[0],
                                    testing_status: 'completed'
                                }]);
                        }
                    }

                    // 6. Clean up BMR data
                    await supabase
                        .from('bmr_template_data')
                        .delete()
                        .eq('template_id', completedBMR.id);

                    await supabase
                        .from('processes')
                        .delete()
                        .eq('template_id', completedBMR.id);

                    // 7. Update BMR status to complete
                    await updateBMRStatus(completedBMR.id, 'complete', completedBMR.productId, completedBMR.assemblyId);

                    // 8. Reset and close modal
                    setShowCompletionModal(false);
                    setCompletedBMR(null);
                    setNewCompletedProduct({
                        BareCode: "",
                        PartNo: "",
                        LotNo: "",
                        SNo: "",
                        name: "",
                        price: "",
                        Quantity: "1.00"
                    });

                    // 9. Reload all data
                    await loadAllData();
                    
                    toast.success(`BMR completed successfully! Product added to stock at price: ₹${totalPrice.toFixed(2)}`);
                } catch (error) {
                    console.error('Error completing BMR:', error);
                    toast.error('Error completing BMR: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Multiple Handlers Functions
    const openMultipleHandlersModal = (process) => {
        setSelectedProcessForMultipleHandlers(process);
        const handlers = process.handlers ? [...process.handlers] : [];
        // Ensure elapsedTime is preserved for each handler
        const handlersWithElapsed = handlers.map(handler => ({
            ...handler,
            elapsedTime: handler.elapsedTime || 0,
            startTime: handler.startTime || null,
            pauseTime: handler.pauseTime || null
        }));
        setMultipleHandlers(handlersWithElapsed);
        setShowMultipleHandlersModal(true);
    };

    const closeMultipleHandlersModal = () => {
        setShowMultipleHandlersModal(false);
        setSelectedProcessForMultipleHandlers(null);
        setMultipleHandlers([]);
        setNewMultipleHandler({
            name: "",
            amount: "",
            status: "initiate"
        });
        
        // Clear handler timers
        setActiveHandlerTimers({});
        setHandlerTimerStarts({});
        setHandlerElapsedTimes({});
    };

    const addMultipleHandler = () => {
        if (!newMultipleHandler.name.trim()) {
            toast.error('Please fill handler name!');
            return;
        }

        const handlerToAdd = {
            id: Date.now().toString(),
            name: newMultipleHandler.name.trim(),
            amount: parseFloat(newMultipleHandler.amount) || 0,
            status: newMultipleHandler.status,
            elapsedTime: 0,
            startTime: null,
            pauseTime: null,
            endTime: null
        };

        setMultipleHandlers(prev => [...prev, handlerToAdd]);
        setNewMultipleHandler({
            name: "",
            amount: "",
            status: "initiate"
        });
        toast.success('Handler added!');
    };

    const removeMultipleHandler = (handlerId) => {
        showConfirmation({
            title: "Remove Handler",
            message: "Are you sure you want to remove this handler?",
            confirmText: "Remove",
            cancelText: "Cancel",
            onConfirm: () => {
                setMultipleHandlers(prev => prev.filter(handler => handler.id !== handlerId));
                
                // Clear timer for removed handler
                setActiveHandlerTimers(prev => {
                    const newTimers = { ...prev };
                    delete newTimers[handlerId];
                    return newTimers;
                });
                setHandlerElapsedTimes(prev => {
                    const newElapsed = { ...prev };
                    delete newElapsed[handlerId];
                    return newElapsed;
                });
                
                toast.success('Handler removed!');
            },
            onCancel: () => {}
        });
    };

    // Save multiple handlers to database
    const saveMultipleHandlers = async () => {
        if (!selectedProcessForMultipleHandlers) return;

        try {
            // Calculate process total time and cost from handlers
            const totalElapsedTime = multipleHandlers.reduce((sum, handler) => 
                sum + (handlerElapsedTimes[handler.id] || handler.elapsedTime || 0), 0);
            
            const totalCost = multipleHandlers.reduce((sum, handler) => {
                const handlerElapsed = handlerElapsedTimes[handler.id] || handler.elapsedTime || 0;
                return sum + ((handler.amount || 0) * (handlerElapsed / 60000));
            }, 0);

            // Update process with multiple handlers
            const { error } = await supabase
                .from('processes')
                .update({
                    handlers: JSON.stringify(multipleHandlers),
                    elapsed_time: totalElapsedTime,
                    total_time: formatTime(totalElapsedTime),
                    total_cost: totalCost,
                    status: multipleHandlers.length > 0 && multipleHandlers.every(h => h.status === 'completed') ? 'completed' : selectedProcessForMultipleHandlers.status
                })
                .eq('id', selectedProcessForMultipleHandlers.id);

            if (error) throw error;

            // Update local state
            setProcesses(prev =>
                prev.map(process =>
                    process.id === selectedProcessForMultipleHandlers.id
                        ? {
                            ...process,
                            handlers: multipleHandlers,
                            elapsedTime: totalElapsedTime,
                            totalTime: formatTime(totalElapsedTime),
                            totalCost: totalCost.toFixed(2),
                            status: multipleHandlers.length > 0 && multipleHandlers.every(h => h.status === 'completed') ? 'completed' : process.status
                        }
                        : process
                )
            );

            toast.success('Multiple handlers saved successfully!');
            closeMultipleHandlersModal();
        } catch (error) {
            toast.error('Error saving multiple handlers: ' + error.message);
        }
    };

    // Handler timer functions
    const startHandlerTimer = (handlerId) => {
        const handler = multipleHandlers.find(h => h.id === handlerId);
        const now = Date.now();
        const elapsed = handler.elapsedTime || 0;
        
        setActiveHandlerTimers(prev => ({ ...prev, [handlerId]: true }));
        setHandlerTimerStarts(prev => ({ 
            ...prev, 
            [handlerId]: now - elapsed
        }));
        
        // Update handler status and preserve elapsed time
        setMultipleHandlers(prev =>
            prev.map(handler =>
                handler.id === handlerId
                    ? { 
                        ...handler, 
                        status: 'inprogress', 
                        startTime: new Date().toISOString(),
                        elapsedTime: elapsed
                    }
                    : handler
            )
        );
    };

    const pauseHandlerTimer = (handlerId) => {
        const currentElapsed = handlerElapsedTimes[handlerId] || 0;
        setActiveHandlerTimers(prev => ({ ...prev, [handlerId]: false }));
        
        // Update handler status and save elapsed time
        setMultipleHandlers(prev =>
            prev.map(handler =>
                handler.id === handlerId
                    ? { 
                        ...handler, 
                        status: 'pending', 
                        pauseTime: new Date().toISOString(),
                        elapsedTime: currentElapsed
                    }
                    : handler
            )
        );
    };

    const stopHandlerTimer = (handlerId) => {
        const handler = multipleHandlers.find(h => h.id === handlerId);
        const currentElapsed = handlerElapsedTimes[handlerId] || handler.elapsedTime || 0;
        const handlerCost = (handler.amount || 0) * (currentElapsed / 60000);
        
        setActiveHandlerTimers(prev => ({ ...prev, [handlerId]: false }));
        
        // Update handler status
        setMultipleHandlers(prev =>
            prev.map(handler =>
                handler.id === handlerId
                    ? { 
                        ...handler, 
                        status: 'completed', 
                        endTime: new Date().toISOString(),
                        elapsedTime: currentElapsed,
                        totalCost: handlerCost.toFixed(2),
                        totalTime: formatTime(currentElapsed)
                    }
                    : handler
            )
        );
    };

    const getHandlerCurrentTimer = (handlerId) => {
        if (activeHandlerTimers[handlerId]) {
            return handlerElapsedTimes[handlerId] || 0;
        }
        const handler = multipleHandlers.find(h => h.id === handlerId);
        return handler?.elapsedTime || 0;
    };

    const calculateHandlerCost = (handler) => {
        const handlerElapsed = handlerElapsedTimes[handler.id] || handler.elapsedTime || 0;
        return ((handler.amount || 0) * (handlerElapsed / 60000)).toFixed(2);
    };

    // Add Global Template Button in BMR Section
    const renderGlobalTemplateButtons = () => {
        if (!selectedBMR) return null;

        return (
            <div className="d-flex align-items-center flex-wrap gap-2 mt-3">
                <button
                    className="btn btn-outline-info btn-sm"
                    onClick={() => {
                        setGlobalTemplateAction("new");
                        setShowGlobalTemplateModal(true);
                    }}
                >
                    <i className="fa-solid fa-database me-1"></i>
                    Global Templates ({globalTemplates.length})
                </button>
                <button
                    className="btn btn-outline-warning btn-sm"
                    onClick={() => {
                        if (selectedBMR.templateData && selectedBMR.templateData.length > 0) {
                            setGlobalTemplateAction("new");
                            setNewGlobalTemplate({
                                ...newGlobalTemplate,
                                name: selectedBMR.name,
                                description: `${selectedProduct?.name} - ${selectedMainAssembly?.name}`,
                                category: selectedMainAssembly?.type || 'assembly',
                                template_data: selectedBMR.templateData
                            });
                            setShowGlobalTemplateModal(true);
                        } else {
                            toast.error('No template data to save as global template!');
                        }
                    }}
                >
                    <i className="fa-solid fa-save me-1"></i>
                    Save as Global Template
                </button>
                <button
                    className="btn btn-outline-success btn-sm"
                    onClick={() => {
                        setGlobalTemplateAction("existing");
                        setShowGlobalTemplateModal(true);
                    }}
                >
                    <i className="fa-solid fa-floppy-disk me-1"></i>
                    Save to Existing Template
                </button>
            </div>
        );
    };

    // View BMR History
    const viewBMRHistory = () => {
        setShowHistoryModal(true);
    };

    // View History Item Details
    const viewHistoryItem = (historyItem) => {
        setSelectedHistoryItem(historyItem);
    };

    // Print History Item with Processes (UPDATED VERSION)
    const printHistoryItem = (historyItem) => {
        const printWindow = window.open('', '_blank');
        const templateData = historyItem.template_data || [];
        const processesData = historyItem.processes_data || [];
        
        const printContent = `
            <html>
                <head>
                    <title>BMR History - ${historyItem.bmr_name}</title>
                    <style>
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            margin: 0; 
                            padding: 20px; 
                            font-size: 12px; 
                            color: #333;
                        }
                        .history-header { 
                            text-align: center; 
                            margin-bottom: 25px; 
                            padding-bottom: 15px; 
                            border-bottom: 2px solid #2c3e50;
                        }
                        .history-header h2 { 
                            color: #2c3e50; 
                            margin: 0 0 5px 0;
                            font-size: 20px;
                        }
                        .history-header h3 { 
                            color: #3498db; 
                            margin: 0 0 15px 0;
                            font-size: 16px;
                        }
                        .history-info { 
                            display: flex; 
                            justify-content: space-between;
                            flex-wrap: wrap;
                            margin-bottom: 25px; 
                            padding: 15px; 
                            border: 1px solid #ddd;
                            border-radius: 5px;
                            background-color: #f8f9fa;
                        }
                        .history-info p { 
                            margin: 5px 0; 
                            flex: 1 0 300px;
                        }
                        .history-table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-top: 15px;
                        }
                        .history-table th, .history-table td { 
                            border: 1px solid #ddd; 
                            padding: 6px; 
                            text-align: left;
                        }
                        .history-table th { 
                            background-color: #f8f9fa; 
                            font-weight: 600;
                            color: #2c3e50;
                        }
                        .history-table tr:nth-child(even) {
                            background-color: #f8f9fa;
                        }
                    </style>
                </head>
                <body>
                    <div class="history-header">
                        <h2>BMR HISTORY RECORD</h2>
                        <h3>${historyItem.bmr_name} - ${historyItem.initial_code}</h3>
                    </div>
                    
                    <div class="history-info">
                        <p><strong>Product:</strong> ${historyItem.product_name}</p>
                        <p><strong>Assembly:</strong> ${historyItem.assembly_name}</p>
                        <p><strong>Department:</strong> ${historyItem.department}</p>
                        <p><strong>Completed:</strong> ${new Date(historyItem.completed_at).toLocaleString()}</p>
                    </div>
                    
                    ${templateData.length > 0 ? `
                        <h4 style="color: #2c3e50; margin-bottom: 10px; font-size: 14px;">MATERIALS USED</h4>
                        <table class="history-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Raw Material</th>
                                    <th>Part No</th>
                                    <th>Internal Serial No</th>
                                    <th>Qty</th>
                                    <th>Price (₹)</th>
                                    <th>Total (₹)</th>
                                    <th>Issued By</th>
                                    <th>Received By</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${templateData.map((item, index) => {
                                    const total = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                                    
                                    return `
                                        <tr>
                                            <td style="text-align: center;">${index + 1}</td>
                                            <td>${item.rawMaterial || ''}</td>
                                            <td>${item.partNo || ''}</td>
                                            <td>${item.internalSerialNo || ''}</td>
                                            <td>${parseFloat(item.quantity || 1).toFixed(2)}</td>
                                            <td>₹${parseFloat(item.price || 0).toFixed(2)}</td>
                                            <td style="text-align: right; font-weight: 600;">₹${total.toFixed(2)}</td>
                                            <td>${item.issuedBy || 'N/A'}</td>
                                            <td>${item.receivedBy || 'N/A'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    ` : ''}
                    
                    ${processesData.length > 0 ? `
                        <h4 style="color: #2c3e50; margin: 25px 0 10px 0; font-size: 14px;">PROCESS DETAILS</h4>
                        <table class="history-table">
                            <thead>
                                <tr>
                                    <th>Process Name</th>
                                    <th>Total Cost (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${processesData.map(process => {
                                    let totalCost = 0;
                                    if (process.handlers && process.handlers.length > 0) {
                                        totalCost = process.handlers.reduce((hSum, handler) => 
                                            hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                                    } else {
                                        totalCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                    }
                                    return `
                                        <tr>
                                            <td><strong>${process.name}</strong></td>
                                            <td style="text-align: right; font-weight: 600;">₹${totalCost.toFixed(2)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    ` : ''}
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center;">
                        <div>Generated by BMR System | Printed on: ${new Date().toLocaleString()}</div>
                    </div>
                    
                    <script>
                        // Auto-print and close after delay
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                                window.close();
                            }, 500);
                        }, 500);
                    </script>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    // Delete History Item
    const deleteHistoryItem = async (historyId) => {
        showConfirmation({
            title: "Delete History Record",
            message: "Are you sure you want to delete this history record?",
            confirmText: "Delete",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('bmr_history')
                        .delete()
                        .eq('id', historyId);

                    if (error) throw error;

                    setBmrHistory(prev => prev.filter(item => item.id !== historyId));
                    toast.success('History record deleted successfully!');
                } catch (error) {
                    toast.error('Error deleting history record: ' + error.message);
                }
            },
            onCancel: () => {}
        });
    };

    // Load saved templates when modal opens
    useEffect(() => {
        if (showSavedTemplates) {
            loadSavedTemplates();
        }
    }, [showSavedTemplates]);

    // Function to auto-fill product data from barcode
    const handleBarcodeChange = async (index, barcode) => {
        if (!barcode.trim()) return;

        try {
            const productInfo = await findProductByVariantBarcode(barcode.trim());
            
            if (productInfo) {
                const field = 'internalSerialNo';
                const value = barcode.trim();
                
                // Update template data
                await updateBMRTemplateProduct(
                    selectedBMR.id,
                    index,
                    field,
                    value,
                    selectedProduct.id,
                    selectedMainAssembly.id
                );

                // Auto-fill other fields if available
                if (productInfo.stock) {
                    await updateBMRTemplateProduct(
                        selectedBMR.id,
                        index,
                        'rawMaterial',
                        productInfo.stock.name || '',
                        selectedProduct.id,
                        selectedMainAssembly.id
                    );

                    await updateBMRTemplateProduct(
                        selectedBMR.id,
                        index,
                        'partNo',
                        productInfo.stock.part_no || '',
                        selectedProduct.id,
                        selectedMainAssembly.id
                    );

                    await updateBMRTemplateProduct(
                        selectedBMR.id,
                        index,
                        'price',
                        productInfo.price || 0,
                        selectedProduct.id,
                        selectedMainAssembly.id
                    );

                    toast.success(`Product auto-filled: ${productInfo.stock.name}`);
                }
            } else {
                toast.error('Product not found in stock or variants!');
            }
        } catch (error) {
            console.error('Error auto-filling product:', error);
            toast.error('Error auto-filling product data');
        }
    };

    // Modified BMR Template Table with decimal quantity support
    const renderBMRTemplateTable = () => {
        return (
            <div className="mb-4 mt-4 fade-in">
                <h4 className="h5 text-primary">BMR Template Structure</h4>
                {selectedBMR.templateData && selectedBMR.templateData.length === 0 ? (
                    <div className="alert alert-warning text-center">
                        No products added to template yet. Click "Add Product to Template" to start building your BMR.
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table bmr-table align-middle text-center">
                            <thead>
                                <tr>
                                    <th>S.NO</th>
                                    <th>RAW MATERIAL/PART/NAME/PRODUCT CODE</th>
                                    <th>PartNo/SKU</th>
                                    <th>INTERNAL SERIAL.NO (Multiple Barcodes)</th>
                                    <th>DESCRIPTION</th>
                                    <th>Total Qty</th>
                                    <th>Avg Price</th>
                                    <th>Total Price</th>
                                    <th>ISSUED BY</th>
                                    <th>RECEIVED BY</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedBMR.templateData && selectedBMR.templateData.map((product, index) => {
                                    const totalQuantity = parseFloat(product.totalQuantity) || parseFloat(product.quantity) || 1.00;
                                    const averagePrice = parseFloat(product.averagePrice) || parseFloat(product.price) || 0;
                                    const totalPrice = totalQuantity * averagePrice;

                                    return (
                                        <tr key={product.id} className="fade-in">
                                            <td className="fw-bold">{index + 1}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={product.rawMaterial || ''}
                                                    onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'rawMaterial', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                    placeholder="Raw material"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={product.partNo || ''}
                                                    onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'partNo', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                    placeholder="Part No"
                                                />
                                            </td>
                                            <td>
                                                <textarea
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={product.internalSerialNo || ''}
                                                    onChange={(e) => {
                                                        updateBMRTemplateProduct(selectedBMR.id, index, 'internalSerialNo', e.target.value, selectedProduct.id, selectedMainAssembly.id);
                                                    }}
                                                    placeholder="Enter multiple barcodes separated by commas"
                                                    rows="2"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={product.description || ''}
                                                    onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'description', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                    placeholder="Description"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={totalQuantity.toFixed(2)}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/[^0-9.]/g, '');
                                                        const parts = value.split('.');
                                                        if (parts.length <= 2) {
                                                            updateBMRTemplateProduct(selectedBMR.id, index, 'totalQuantity', value, selectedProduct.id, selectedMainAssembly.id);
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    pattern="[0-9]*\.?[0-9]{0,2}"
                                                    title="Enter decimal quantity (e.g., 2.5)"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={averagePrice.toFixed(2)}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/[^0-9.]/g, '');
                                                        const parts = value.split('.');
                                                        if (parts.length <= 2) {
                                                            updateBMRTemplateProduct(selectedBMR.id, index, 'averagePrice', value, selectedProduct.id, selectedMainAssembly.id);
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    pattern="[0-9]*\.?[0-9]{0,2}"
                                                    title="Enter average price"
                                                    step="0.01"
                                                />
                                            </td>
                                            <td>
                                                <div className="text-end">
                                                    <strong className="text-success">₹{totalPrice.toFixed(2)}</strong>
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={product.issuedBy || ''}
                                                    onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'issuedBy', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                    placeholder="Issued by"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-control bmr-form-control form-control-sm"
                                                    value={product.receivedBy || ''}
                                                    onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'receivedBy', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                    placeholder="Received by"
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => {
                                                        showConfirmation({
                                                            title: "Delete Template Item",
                                                            message: "Are you sure you want to delete this template item?",
                                                            confirmText: "Delete",
                                                            cancelText: "Cancel",
                                                            onConfirm: async () => {
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('bmr_template_data')
                                                                        .delete()
                                                                        .eq('id', product.id);

                                                                    if (error) throw error;

                                                                    // Update local state
                                                                    const updatedTemplateData = selectedBMR.templateData.filter((_, i) => i !== index);
                                                                    setSelectedBMR(prev => ({
                                                                        ...prev,
                                                                        templateData: updatedTemplateData
                                                                    }));

                                                                    // Update bmrProducts state
                                                                    setBmrProducts(prev =>
                                                                        prev.map(p =>
                                                                            p.id === selectedProduct.id
                                                                                ? {
                                                                                    ...p,
                                                                                    assemblies: p.assemblies.map(a =>
                                                                                        a.id === selectedMainAssembly.id
                                                                                            ? {
                                                                                                ...a,
                                                                                                bmrs: a.bmrs.map(b =>
                                                                                                    b.id === selectedBMR.id
                                                                                                        ? { ...b, templateData: updatedTemplateData }
                                                                                                        : b
                                                                                                )
                                                                                            }
                                                                                            : a
                                                                                    )
                                                                                }
                                                                                : p
                                                                            )
                                                                    );
                                                                } catch (error) {
                                                                    toast.error('Error deleting template item: ' + error.message);
                                                                }
                                                            },
                                                            onCancel: () => {}
                                                        });
                                                    }}
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    if (!activeProductionDepartment) {
        return (
            <div className="container mt-5">
                <div className="card bmr-card">
                    <div className="card-header bg-primary text-white">
                        <h4 className="mb-0"><i className="fa-solid fa-industry me-2"></i>No Production Department Selected</h4>
                    </div>
                    <div className="card-body text-center py-5">
                        <i className="fa-solid fa-industry text-muted fa-4x mb-3"></i>
                        <h5 className="text-muted mb-3">Please select a production department from the Production page first.</h5>
                        <button 
                            className="btn btn-primary btn-lg"
                            onClick={() => window.location.href = '/Production'}
                        >
                            <i className="fa-solid fa-arrow-right me-2"></i>
                            Go to Production Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bmr-container py-4">
            <div className="container">
                {/* Header Section - REMOVED STATUS SECTION */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="card bmr-card shadow-sm">
                            <div className="card-header bg-gradient-primary text-white">
                                <h1 className="h3 mb-0">{getPageTitle()}</h1>
                            </div>
                            <div className="card-body">
                                {/* Add New Product */}
                                <div className="add-product-section mb-4">
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control bmr-form-control form-control-lg"
                                            value={newProductName}
                                            onChange={(e) => setNewProductName(e.target.value)}
                                            placeholder="Add new product"
                                            onKeyPress={(e) => e.key === 'Enter' && addNewProduct()}
                                        />
                                        <button className="btn btn-primary btn-lg" onClick={addNewProduct}>
                                            <i className="fa-solid fa-plus me-2"></i>
                                            Add Product
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="d-flex flex-wrap gap-2">
                                    <button 
                                        className="btn btn-outline-info btn-sm"
                                        onClick={viewBMRHistory}
                                    >
                                        <i className="fa-solid fa-history me-2"></i>
                                        View History ({bmrHistory.length})
                                    </button>
                                    <button 
                                        className="btn btn-outline-warning btn-sm"
                                        onClick={() => setShowProcessTemplateModal(true)}
                                    >
                                        <i className="fa-solid fa-gear me-2"></i>
                                        Process Templates ({processTemplates.length})
                                    </button>
                                    <button 
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={() => setShowGlobalProcessTemplateModal(true)}
                                    >
                                        <i className="fa-solid fa-layer-group me-2"></i>
                                        Global Process Templates ({globalProcessTemplates.length})
                                    </button>
                                    <button 
                                        className="btn btn-outline-success btn-sm"
                                        onClick={() => {
                                            setGlobalTemplateAction("new");
                                            setShowGlobalTemplateModal(true);
                                        }}
                                    >
                                        <i className="fa-solid fa-database me-2"></i>
                                        Global Templates ({globalTemplates.length})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Products Section */}
                <div className="products-section mb-4">
                    <div className="row">
                        {bmrProducts.length === 0 ? (
                            <div className="col-12">
                                <div className="card bmr-card shadow-sm">
                                    <div className="card-body text-center py-5">
                                        <i className="fa-solid fa-boxes text-muted fa-4x mb-3"></i>
                                        <h5 className="text-muted mb-3">No products found</h5>
                                        <p className="text-muted">Add your first product using the form above</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            bmrProducts.map(product => (
                                <div key={product.id} className="col-xl-4 col-lg-6 col-md-6 mb-4">
                                    <div className="card bmr-card h-100 shadow-sm">
                                        <div className="card-header bg-light">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <h6 className="card-title mb-0 fw-bold text-primary">{product.name}</h6>
                                                <div className="btn-group">
                                                    <button
                                                        className="btn btn-sm btn-outline-secondary"
                                                        onClick={() => startEditProduct(product)}
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#editProductModal"
                                                        title="Edit Product"
                                                    >
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => deleteProduct(product.id)}
                                                        title="Delete Product"
                                                    >
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <small className="text-dark d-block mt-1">
                                                <i className="fa-solid fa-layer-group me-1"></i>
                                                Assembly Type: {product.hasAssembly ? 'Main & Sub Assembly' : 'Simple Assemblies Only'}
                                            </small>
                                        </div>
                                        <div className="card-body">
                                            {product.hasAssembly ? (
                                                <div className="assembly-buttons d-grid gap-2 mb-3">
                                                    <button 
                                                        className="btn btn-dark btn-sm"
                                                        onClick={() => addAssembly(product.id, "main")}
                                                    >
                                                        <i className="fa-solid fa-layer-group me-2"></i>
                                                        MAIN ASSEMBLY
                                                    </button>
                                                    <button 
                                                        className="btn btn-outline-dark btn-sm"
                                                        onClick={() => addAssembly(product.id, "sub")}
                                                    >
                                                        <i className="fa-solid fa-layer-group me-2"></i>
                                                        SUB ASSEMBLY
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="assembly-buttons mb-3">
                                                    <button 
                                                        className="btn btn-dark btn-sm w-100"
                                                        onClick={() => addAssembly(product.id, "assembly")}
                                                    >
                                                        <i className="fa-solid fa-plus me-2"></i>
                                                        ADD ASSEMBLY
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Assemblies */}
                                            {product.assemblies.map(assembly => (
                                                <div key={assembly.id} className={`assembly-item mt-2 p-2 border rounded ${assembly.type === 'main' ? 'assembly-main' : assembly.type === 'sub' ? 'assembly-sub' : 'assembly-simple'}`}>
                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                        <strong className="d-flex align-items-center">
                                                            <i className="fa-solid fa-cube me-2"></i>
                                                            {assembly.name} 
                                                            <small className="text-muted ms-2">
                                                                ({assembly.type === 'main' ? 'Main' : assembly.type === 'sub' ? 'Sub' : 'Assembly'})
                                                            </small>
                                                        </strong>
                                                        <div className="btn-group">
                                                            <button
                                                                className="btn btn-sm btn-outline-secondary"
                                                                onClick={() => startEditAssembly(assembly)}
                                                                data-bs-toggle="modal"
                                                                data-bs-target="#editAssemblyModal"
                                                                title="Edit Assembly"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => deleteAssembly(product.id, assembly.id)}
                                                                title="Delete Assembly"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* BMRs for this assembly */}
                                                    <div className="bmr-list mt-1">
                                                        {assembly.bmrs.map(bmr => (
                                                            <div key={bmr.id} className="d-flex align-items-center mb-1">
                                                                <button
                                                                    className={`btn btn-sm me-1 flex-grow-1 ${
                                                                        bmr.status === 'active' ? 'btn-outline-primary' : 
                                                                        bmr.status === 'inprogress' ? 'btn-warning' : 
                                                                        bmr.status === 'complete' ? 'btn-success' :
                                                                        'btn-outline-secondary'
                                                                    }`}
                                                                    onClick={() => {
                                                                        setSelectedProduct(product);
                                                                        setSelectedMainAssembly(assembly);
                                                                        setSelectedBMR(bmr);
                                                                    }}
                                                                    title={`Click to manage ${bmr.name}`}
                                                                >
                                                                    <i className="fa-solid fa-file-contract me-1"></i>
                                                                    {bmr.name}
                                                                    <span className={`badge ms-1 ${
                                                                        bmr.status === 'active' ? 'bg-primary' : 
                                                                        bmr.status === 'inprogress' ? 'bg-warning' : 
                                                                        bmr.status === 'complete' ? 'bg-success' :
                                                                        'bg-secondary'
                                                                    }`}>
                                                                        {bmr.initialCode}
                                                                    </span>
                                                                    {bmr.status === 'inactive' && (
                                                                        <span className="badge bg-dark ms-1">
                                                                            Inactive
                                                                        </span>
                                                                    )}
                                                                </button>
                                                                <div className="btn-group btn-group-sm">
                                                                    <button
                                                                        className="btn btn-outline-secondary"
                                                                        onClick={() => startEditBMR(bmr, product.id, assembly.id)}
                                                                        data-bs-toggle="modal"
                                                                        data-bs-target="#editBMRModal"
                                                                        title="Edit BMR"
                                                                    >
                                                                        <i className="fa-solid fa-pen"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline-danger"
                                                                        onClick={() => deleteBMR(bmr.id, product.id, assembly.id)}
                                                                        title="Delete BMR"
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {/* Add BMR Form */}
                                                    <div className="add-bmr-form mt-2">
                                                        <div className="input-group input-group-sm">
                                                            <input
                                                                type="text"
                                                                className="form-control bmr-form-control"
                                                                placeholder="BMR Name"
                                                                value={newBMR.name}
                                                                onChange={(e) => setNewBMR(prev => ({ ...prev, name: e.target.value }))}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="form-control bmr-form-control"
                                                                placeholder="Initial Code"
                                                                value={newBMR.initialCode}
                                                                onChange={(e) => setNewBMR(prev => ({ ...prev, initialCode: e.target.value }))}
                                                            />
                                                            <button
                                                                className="btn btn-primary"
                                                                onClick={() => addBMR(product.id, assembly.id)}
                                                            >
                                                                <i className="fa-solid fa-plus"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* BMR Management Section */}
                {selectedProduct && selectedMainAssembly && selectedBMR && (
                    <div className="bmr-container mt-4">
                        <div className="card bmr-card shadow-lg border-primary">
                            <div className="card-header bg-primary text-white">
                                <h2 className="h4 mb-0">
                                    <i className="fa-solid fa-file-contract me-2"></i>
                                    {selectedProduct.name} ({selectedMainAssembly.name}) - {selectedBMR.name}
                                </h2>
                            </div>
                            <div className="card-body">
                                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                                    <div>
                                        <div className="btn-group btn-group-sm mt-1">
                                            <button
                                                className={`btn ${selectedBMR.status === 'active' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => updateBMRStatus(selectedBMR.id, 'active', selectedProduct.id, selectedMainAssembly.id)}
                                            >
                                                Active
                                            </button>
                                            <button
                                                className={`btn ${selectedBMR.status === 'inprogress' ? 'btn-warning' : 'btn-outline-warning'}`}
                                                onClick={() => updateBMRStatus(selectedBMR.id, 'inprogress', selectedProduct.id, selectedMainAssembly.id)}
                                            >
                                                In Progress
                                            </button>
                                            <button
                                                className={`btn ${selectedBMR.status === 'inactive' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                                onClick={() => updateBMRStatus(selectedBMR.id, 'inactive', selectedProduct.id, selectedMainAssembly.id)}
                                            >
                                                Inactive
                                            </button>
                                            <button
                                                className={`btn ${selectedBMR.status === 'complete' ? 'btn-success' : 'btn-outline-success'}`}
                                                onClick={() => completeBMR(selectedBMR)}
                                                disabled={!areAllProcessesCompleted(selectedBMR.id)}
                                                title={areAllProcessesCompleted(selectedBMR.id) ? "Complete BMR" : "Complete all processes first"}
                                            >
                                                Complete
                                            </button>
                                        </div>
                                    </div>
                                    <div className="d-flex flex-wrap gap-2 mt-2">
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => addProductToBMRTemplate(selectedBMR.id, selectedProduct.id, selectedMainAssembly.id)}
                                        >
                                            <i className="fa-solid fa-plus me-1"></i>
                                            Add Product to Template
                                        </button>
                                        <button
                                            className="btn btn-sm btn-info"
                                            onClick={() => saveBMRTemplate(selectedBMR.id, selectedProduct.id, selectedMainAssembly.id)}
                                        >
                                            <i className="fa-solid fa-save me-1"></i>
                                            Save Template
                                        </button>
                                        <button
                                            className="btn btn-sm btn-warning"
                                            onClick={() => openProcessModal(selectedBMR)}
                                        >
                                            <i className="fa-solid fa-gears me-1"></i>
                                            Processes ({getBMRProcesses(selectedBMR.id).length})
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-info"
                                            onClick={() => viewSavedTemplate(selectedBMR.id)}
                                        >
                                            <i className="fa-solid fa-folder-open me-1"></i>
                                            View Template
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-success"
                                            onClick={() => printBMRTemplate(selectedBMR, false)}
                                            disabled={!selectedBMR.templateData || selectedBMR.templateData.length === 0}
                                        >
                                            <i className="fa-solid fa-print me-1"></i>
                                            Print Template
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={() => printBMRTemplate(selectedBMR, true)}
                                            disabled={!selectedBMR.templateData || selectedBMR.templateData.length === 0}
                                        >
                                            <i className="fa-solid fa-print me-1"></i>
                                            Print with Processes
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Add Global Template Button */}
                                {renderGlobalTemplateButtons()}

                                {/* BMR Template Table - Modified to support decimal quantities */}
                                {renderBMRTemplateTable()}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="modal fade show bmr-modal con" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-warning text-white">
                                <h5 className="modal-title">{confirmConfig.title}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfirmModal(false)}></button>
                            </div>
                            <div className="modal-body text-center py-4">
                                <i className="fa-solid fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                                <p className="lead">{confirmConfig.message}</p>
                            </div>
                            <div className="modal-footer justify-content-center">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowConfirmModal(false);
                                    confirmConfig.onCancel();
                                }}>
                                    {confirmConfig.cancelText}
                                </button>
                                <button type="button" className="btn btn-danger" onClick={() => {
                                    setShowConfirmModal(false);
                                    confirmConfig.onConfirm();
                                }}>
                                    {confirmConfig.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Process Template Modal - For Process Modal Only (Load Template) */}
            {showLoadProcessTemplateModal && (
                <div className="modal load fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-info text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-layer-group me-2"></i>
                                    Load Global Process Templates
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => {
                                    setShowLoadProcessTemplateModal(false);
                                    setSelectedTemplateForProcess(null);
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3 border-info">
                                    <div className="card-header bg-light">
                                        <h6>Save to Existing Template</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-12">
                                                <div className="form-floating mb-3">
                                                    <select
                                                        className="form-select"
                                                        value={selectedTemplateForProcess?.id || ""}
                                                        onChange={(e) => {
                                                            const template = globalProcessTemplates.find(t => t.id === e.target.value);
                                                            setSelectedTemplateForProcess(template);
                                                            if (template) {
                                                                setNewGlobalProcessTemplate(prev => ({
                                                                    ...prev,
                                                                    processes: getBMRProcesses(selectedBMRForProcess?.id) || []
                                                                }));
                                                            }
                                                        }}
                                                    >
                                                        <option value="">-- Select Existing Template --</option>
                                                        {globalProcessTemplates.map(template => (
                                                            <option key={template.id} value={template.id}>
                                                                {template.name} - {template.processes?.length || 0} processes
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <label>Select Template to Update</label>
                                                </div>
                                            </div>
                                            {selectedTemplateForProcess && (
                                                <div className="col-md-12">
                                                    <div className="alert alert-info">
                                                        <p><strong>Selected Template:</strong> {selectedTemplateForProcess.name}</p>
                                                        <p><strong>Current Processes:</strong> {selectedTemplateForProcess.processes?.length || 0}</p>
                                                        <p><strong>New Processes:</strong> {getBMRProcesses(selectedBMRForProcess?.id)?.length || 0}</p>
                                                        <p className="text-warning">
                                                            <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                                            This will replace all existing processes in the template with current BMR processes.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="col-md-12">
                                                <div className="d-flex gap-2">
                                                    <button 
                                                        className="btn btn-primary"
                                                        onClick={saveToExistingProcessTemplate}
                                                        disabled={!selectedTemplateForProcess}
                                                    >
                                                        <i className="fa-solid fa-save me-2"></i>
                                                        Save to Selected Template
                                                    </button>
                                                    <button 
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => {
                                                            setSelectedTemplateForProcess(null);
                                                        }}
                                                    >
                                                        Clear Selection
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5 className="mb-3">Available Global Process Templates</h5>
                                {globalProcessTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No global process templates found.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Template Name</th>
                                                    <th>Description</th>
                                                    <th>Processes</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {globalProcessTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td className="text-center">{index + 1}</td>
                                                        <td>
                                                            <strong>{template.name}</strong>
                                                            {template.is_public && (
                                                                <span className="badge bg-success ms-2">Public</span>
                                                            )}
                                                        </td>
                                                        <td>{template.description || 'No description'}</td>
                                                        <td className="text-center">
                                                            <span className="badge bg-primary">
                                                                {template.processes?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => loadGlobalProcessTemplate(template)}
                                                                    disabled={!selectedBMRForProcess}
                                                                    title="Load Template"
                                                                >
                                                                    <i className="fa-solid fa-download"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-info me-1"
                                                                    onClick={() => {
                                                                        setSelectedGlobalProcessTemplate(template);
                                                                    }}
                                                                    title="View Details"
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowLoadProcessTemplateModal(false);
                                    setSelectedTemplateForProcess(null);
                                }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Process Template Modal - Full Version */}
            {showGlobalProcessTemplateModal && !showLoadProcessTemplateModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-layer-group me-2"></i>
                                    Global Process Templates - {activeProductionDepartment}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => {
                                    setShowGlobalProcessTemplateModal(false);
                                    setTemplateAction("new");
                                    setSelectedTemplateForProcess(null);
                                    setNewGlobalProcessTemplate({
                                        name: "",
                                        description: "",
                                        processes: [],
                                        is_public: true
                                    });
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3 border-primary">
                                    <div className="card-header bg-light">
                                        <h6>Add New Global Process Template</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-8">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="text"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Template Name"
                                                        value={newGlobalProcessTemplate.name}
                                                        onChange={(e) => setNewGlobalProcessTemplate(prev => ({ ...prev, name: e.target.value }))}
                                                    />
                                                    <label>Template Name *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="form-check form-switch mt-3">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        checked={newGlobalProcessTemplate.is_public}
                                                        onChange={(e) => setNewGlobalProcessTemplate(prev => ({ ...prev, is_public: e.target.checked }))}
                                                        id="isPublicSwitchProcess"
                                                    />
                                                    <label className="form-check-label" htmlFor="isPublicSwitchProcess">
                                                        Public Template
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="form-floating mb-3">
                                                    <textarea
                                                        className="form-control bmr-form-control"
                                                        placeholder="Description"
                                                        value={newGlobalProcessTemplate.description}
                                                        onChange={(e) => setNewGlobalProcessTemplate(prev => ({ ...prev, description: e.target.value }))}
                                                        style={{ height: '100px' }}
                                                    />
                                                    <label>Description</label>
                                                </div>
                                            </div>

                                            {/* Add Process to Template */}
                                            <div className="col-md-12">
                                                <div className="card mb-3">
                                                    <div className="card-header bg-light">
                                                        <h6>Add Process to Template</h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="row">
                                                            <div className="col-md-12">
                                                                <div className="form-floating mb-3">
                                                                    <input
                                                                        type="text"
                                                                        className="form-control bmr-form-control"
                                                                        placeholder="Process Name"
                                                                        value={newProcess.name}
                                                                        onChange={(e) => setNewProcess(prev => ({ ...prev, name: e.target.value }))}
                                                                    />
                                                                    <label>Process Name *</label>
                                                                </div>
                                                            </div>
                                                            <div className="col-md-12">
                                                                <button 
                                                                    className="btn btn-primary"
                                                                    onClick={addProcessToGlobalTemplate}
                                                                    disabled={!newProcess.name.trim()}
                                                                >
                                                                    <i className="fa-solid fa-plus me-2"></i>
                                                                    Add Process to Template
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Template Processes List */}
                                            {newGlobalProcessTemplate.processes.length > 0 && (
                                                <div className="col-md-12">
                                                    <h6>Template Processes ({newGlobalProcessTemplate.processes.length})</h6>
                                                    <div className="table-responsive">
                                                        <table className="table bmr-table table-sm">
                                                            <thead className="table-light">
                                                                <tr>
                                                                    <th>#</th>
                                                                    <th>Process Name</th>
                                                                    <th>Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {newGlobalProcessTemplate.processes.map((process, index) => (
                                                                    <tr key={index}>
                                                                        <td className="text-center">{index + 1}</td>
                                                                        <td>{process.name}</td>
                                                                        <td>
                                                                            <button
                                                                                className="btn btn-sm btn-outline-danger"
                                                                                onClick={() => removeProcessFromGlobalTemplate(index)}
                                                                            >
                                                                                <i className="fa-solid fa-trash"></i>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="col-md-12">
                                                <div className="d-flex gap-2">
                                                    <button 
                                                        className="btn btn-primary"
                                                        onClick={addGlobalProcessTemplate}
                                                        disabled={!newGlobalProcessTemplate.name.trim() || newGlobalProcessTemplate.processes.length === 0}
                                                    >
                                                        <i className="fa-solid fa-plus me-2"></i>
                                                        Save as New Template
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5 className="mb-3">Available Global Process Templates</h5>
                                {globalProcessTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No global process templates found. Create your first template above.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Template Name</th>
                                                    <th>Description</th>
                                                    <th>Processes</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {globalProcessTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td className="text-center">{index + 1}</td>
                                                        <td>
                                                            <strong>{template.name}</strong>
                                                            {template.is_public && (
                                                                <span className="badge bg-success ms-2">Public</span>
                                                            )}
                                                        </td>
                                                        <td>{template.description || 'No description'}</td>
                                                        <td className="text-center">
                                                            <span className="badge bg-primary">
                                                                {template.processes?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => {
                                                                        setSelectedGlobalProcessTemplate(template);
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger me-1"
                                                                    onClick={() => deleteGlobalProcessTemplate(template.id)}
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowGlobalProcessTemplateModal(false);
                                    setTemplateAction("new");
                                    setSelectedTemplateForProcess(null);
                                    setNewGlobalProcessTemplate({
                                        name: "",
                                        description: "",
                                        processes: [],
                                        is_public: true
                                    });
                                }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Global Process Template Details */}
            {selectedGlobalProcessTemplate && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-info text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-eye me-2"></i>
                                    Template Details - {selectedGlobalProcessTemplate.name}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedGlobalProcessTemplate(null)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Template Name:</strong> {selectedGlobalProcessTemplate.name}</p>
                                                <p><strong>Description:</strong> {selectedGlobalProcessTemplate.description || 'No description'}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Department:</strong> {selectedGlobalProcessTemplate.department || 'All'}</p>
                                                <p><strong>Public:</strong> {selectedGlobalProcessTemplate.is_public ? 'Yes' : 'No'}</p>
                                                <p><strong>Total Processes:</strong> {selectedGlobalProcessTemplate.processes?.length || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {selectedGlobalProcessTemplate.processes?.length > 0 ? (
                                    <>
                                        <h5>Process List</h5>
                                        <div className="table-responsive">
                                            <table className="table bmr-table">
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Process Name</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedGlobalProcessTemplate.processes.map((process, index) => (
                                                        <tr key={index}>
                                                            <td>{index + 1}</td>
                                                            <td><strong>{process.name}</strong></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        No processes in this template.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedGlobalProcessTemplate(null)}>
                                    Close
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => loadGlobalProcessTemplate(selectedGlobalProcessTemplate)}
                                    disabled={!selectedBMRForProcess}
                                >
                                    <i className="fa-solid fa-download me-2"></i>
                                    Load Template
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Process Management Modal with Multiple Handlers Support */}
            {showProcessModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-warning text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-gears me-2"></i>
                                    Process Management - {selectedBMRForProcess?.name}
                                    <span className="badge bg-light text-dark ms-2">
                                        {getBMRProcesses(selectedBMRForProcess?.id).length} Processes
                                    </span>
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={closeProcessModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                        <button 
                                            className="btn btn-primary btn-sm"
                                            onClick={openAddProcessModal}
                                        >
                                            <i className="fa-solid fa-plus me-1"></i>
                                            Add New Process
                                        </button>
                                        <button 
                                            className="btn btn-info btn-sm"
                                            onClick={() => {
                                                setShowLoadProcessTemplateModal(true);
                                            }}
                                        >
                                            <i className="fa-solid fa-layer-group me-1"></i>
                                            Load Process Template
                                        </button>
                                        {areAllProcessesCompleted(selectedBMRForProcess?.id) && (
                                            <button 
                                                className="btn btn-success btn-sm"
                                                onClick={() => completeBMR(selectedBMRForProcess)}
                                            >
                                                <i className="fa-solid fa-check me-1"></i>
                                                Complete BMR
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <span className="badge bg-warning text-dark me-2">
                                            <i className="fa-solid fa-clock me-1"></i>
                                            Active Timers: {Object.keys(activeTimers).length}
                                        </span>
                                        <button 
                                            className="btn btn-outline-secondary btn-sm"
                                            onClick={() => loadProcesses()}
                                        >
                                            <i className="fa-solid fa-refresh me-1"></i>
                                            Refresh
                                        </button>
                                    </div>
                                </div>

                                <div className="table-responsive">
                                    <table className="table bmr-table table-hover">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Process Name</th>
                                                <th>Handler(s)</th>
                                                <th>Timer</th>
                                                <th>Current Cost</th>
                                                <th>Total Time</th>
                                                <th>Total Cost (₹)</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getBMRProcesses(selectedBMRForProcess?.id).length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4">
                                                        <i className="fa-solid fa-gear fa-2x text-muted mb-3"></i>
                                                        <p className="text-muted">No processes added yet.</p>
                                                        <button 
                                                            className="btn btn-primary btn-sm"
                                                            onClick={openAddProcessModal}
                                                        >
                                                            <i className="fa-solid fa-plus me-1"></i>
                                                            Add Your First Process
                                                        </button>
                                                    </td>
                                                </tr>
                                            ) : (
                                                getBMRProcesses(selectedBMRForProcess?.id).map(process => {
                                                    const hasMultipleHandlers = process.handlers && process.handlers.length > 0;
                                                    const handlerNames = hasMultipleHandlers 
                                                        ? process.handlers.map(h => h.name).join(' / ')
                                                        : (process.handler || 'No handlers');
                                                    
                                                    let totalProcessTime = 0;
                                                    let totalProcessCost = 0;
                                                    
                                                    if (hasMultipleHandlers) {
                                                        process.handlers.forEach(handler => {
                                                            totalProcessTime += handler.elapsedTime || 0;
                                                            totalProcessCost += (handler.amount || 0) * ((handler.elapsedTime || 0) / 60000);
                                                        });
                                                    } else {
                                                        totalProcessTime = process.elapsedTime || 0;
                                                        totalProcessCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                                    }
                                                    
                                                    return (
                                                        <tr key={process.id} className={process.status === 'completed' ? 'table-success' : process.status === 'inprogress' ? 'table-warning' : ''}>
                                                            <td>
                                                                <strong>{process.name}</strong>
                                                                {hasMultipleHandlers && (
                                                                    <div className="text-muted small">
                                                                        <i className="fa-solid fa-users me-1"></i>
                                                                        {process.handlers.length} handler(s)
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {hasMultipleHandlers ? (
                                                                    <div className="small">
                                                                        {process.handlers.map((handler, idx) => (
                                                                            <div key={idx} className="text-muted">
                                                                                {handler.name}: ₹{handler.amount}/min
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    `₹${process.amount}/min`
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className="font-monospace timer-display">
                                                                    {formatTime(totalProcessTime)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="fw-bold text-success">₹{totalProcessCost.toFixed(2)}</span>
                                                            </td>
                                                            <td>{process.totalTime || '-'}</td>
                                                            <td>{process.totalCost ? `₹${process.totalCost}` : '-'}</td>
                                                            <td>
                                                                <div className="btn-group btn-group-sm">
                                                                    {!hasMultipleHandlers && (
                                                                        <>
                                                                            {process.status === 'initiate' && (
                                                                                <button
                                                                                    className="btn btn-success"
                                                                                    onClick={() => startTimer(process.id)}
                                                                                    title="Start Process"
                                                                                >
                                                                                    <i className="fa-solid fa-play"></i>
                                                                                </button>
                                                                            )}
                                                                            {process.status === 'inprogress' && (
                                                                                <>
                                                                                    <button
                                                                                        className="btn btn-warning"
                                                                                        onClick={() => pauseTimer(process.id)}
                                                                                        title="Pause Process"
                                                                                    >
                                                                                        <i className="fa-solid fa-pause"></i>
                                                                                    </button>
                                                                                    <button
                                                                                        className="btn btn-danger"
                                                                                        onClick={() => stopTimer(process.id)}
                                                                                        title="Stop Process"
                                                                                    >
                                                                                        <i className="fa-solid fa-stop"></i>
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                            {process.status === 'pending' && (
                                                                                <button
                                                                                    className="btn btn-success"
                                                                                    onClick={() => startTimer(process.id)}
                                                                                    title="Resume Process"
                                                                                >
                                                                                    <i className="fa-solid fa-play"></i>
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        className="btn btn-outline-primary"
                                                                        onClick={() => openMultipleHandlersModal(process)}
                                                                        title={hasMultipleHandlers ? "Manage Handlers" : "Add Handlers"}
                                                                    >
                                                                        <i className="fa-solid fa-users"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline-secondary"
                                                                        onClick={() => startEditProcess(process)}
                                                                        title="Edit Process"
                                                                    >
                                                                        <i className="fa-solid fa-pen"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-outline-danger"
                                                                        onClick={() => deleteProcess(process.id)}
                                                                        title="Delete Process"
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Process Summary */}
                                {getBMRProcesses(selectedBMRForProcess?.id).length > 0 && (
                                    <div className="card mt-3 border-info">
                                        <div className="card-header bg-info text-white">
                                            <h6 className="mb-0"><i className="fa-solid fa-chart-bar me-2"></i>Process Summary</h6>
                                        </div>
                                        <div className="card-body">
                                            <div className="row">
                                                <div className="col-md-3">
                                                    <p><strong>Total Processes:</strong> {getBMRProcesses(selectedBMRForProcess?.id).length}</p>
                                                </div>
                                                <div className="col-md-3">
                                                    <p><strong>Total Handlers:</strong> {getBMRProcesses(selectedBMRForProcess?.id).reduce((sum, process) => 
                                                        sum + (process.handlers?.length || 0), 0)}</p>
                                                </div>
                                                <div className="col-md-3">
                                                    <p><strong>Completed:</strong> {getBMRProcesses(selectedBMRForProcess?.id).filter(p => p.status === 'completed').length}</p>
                                                </div>
                                                <div className="col-md-3">
                                                    <p><strong>In Progress:</strong> {getBMRProcesses(selectedBMRForProcess?.id).filter(p => p.status === 'inprogress').length}</p>
                                                </div>
                                                <div className="col-md-12 mt-3">
                                                    <div className="progress mb-2">
                                                        <div 
                                                            className="progress-bar bg-success" 
                                                            role="progressbar" 
                                                            style={{ 
                                                                width: `${(getBMRProcesses(selectedBMRForProcess?.id).filter(p => p.status === 'completed').length / getBMRProcesses(selectedBMRForProcess?.id).length) * 100}%` 
                                                            }}
                                                        >
                                                            {Math.round((getBMRProcesses(selectedBMRForProcess?.id).filter(p => p.status === 'completed').length / getBMRProcesses(selectedBMRForProcess?.id).length) * 100)}%
                                                        </div>
                                                    </div>
                                                    <small className="text-muted">Progress: {getBMRProcesses(selectedBMRForProcess?.id).filter(p => p.status === 'completed').length} of {getBMRProcesses(selectedBMRForProcess?.id).length} completed</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeProcessModal}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Process Modal */}
            {showAddProcessModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog">
                        <div className="modal-content shadow">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-gear me-2"></i>
                                    {newProcess.id ? 'Edit Process' : 'Add New Process'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={closeAddProcessModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="Process Name"
                                                value={newProcess.name}
                                                onChange={(e) => setNewProcess(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                            <label>Process Name *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <select
                                                className="form-select bmr-form-control"
                                                value={newProcess.handler}
                                                onChange={(e) => handleHandlerNameChange(e.target.value)}
                                            >
                                                <option value="">-- Select Handler --</option>
                                                {processTemplates.map((template) => (
                                                    <option key={template.id} value={template.handler_name}>
                                                        {template.handler_name} (₹{template.amount}/min)
                                                    </option>
                                                ))}
                                            </select>
                                            <label>Handler Name</label>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <div className="alert alert-info">
                                            <small>
                                                <i className="fa-solid fa-info-circle me-2"></i>
                                                You can add multiple handlers to this process later by clicking the <i className="fa-solid fa-users"></i> button in the process list.
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeAddProcessModal}>
                                    Cancel
                                </button>
                                {newProcess.id ? (
                                    <button type="button" className="btn btn-primary" onClick={updateProcess}>
                                        Update Process
                                    </button>
                                ) : (
                                    <button type="button" className="btn btn-primary" onClick={addNewProcess}>
                                        Add Process
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Multiple Handlers Modal */}
            {showMultipleHandlersModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-users me-2"></i>
                                    Multiple Handlers - {selectedProcessForMultipleHandlers?.name}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={closeMultipleHandlersModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h6>Add New Handler</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-8">
                                                <div className="form-floating mb-3">
                                                    <select
                                                        className="form-select bmr-form-control"
                                                        value={newMultipleHandler.name}
                                                        onChange={(e) => {
                                                            const selectedHandler = processTemplates.find(t => t.handler_name === e.target.value);
                                                            setNewMultipleHandler(prev => ({
                                                                ...prev,
                                                                name: e.target.value,
                                                                amount: selectedHandler ? selectedHandler.amount.toString() : prev.amount
                                                            }));
                                                        }}
                                                    >
                                                        <option value="">-- Select Handler from Template --</option>
                                                        {processTemplates.map((template) => (
                                                            <option key={template.id} value={template.handler_name}>
                                                                {template.handler_name} (₹{template.amount}/min)
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <label>Handler Name *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="number"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Amount per minute"
                                                        value={newMultipleHandler.amount}
                                                        onChange={(e) => setNewMultipleHandler(prev => ({ ...prev, amount: e.target.value }))}
                                                        step="0.01"
                                                    />
                                                    <label>Amount per minute (₹) *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <button 
                                                    className="btn btn-primary"
                                                    onClick={addMultipleHandler}
                                                    disabled={!newMultipleHandler.name.trim() || !newMultipleHandler.amount}
                                                >
                                                    <i className="fa-solid fa-plus me-2"></i>
                                                    Add Handler
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5 className="mb-3">Current Handlers ({multipleHandlers.length})</h5>
                                {multipleHandlers.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        <i className="fa-solid fa-users-slash fa-2x mb-3"></i>
                                        <p>No handlers added yet. Add handlers from template above.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Handler Name</th>
                                                    <th>Amount (₹/min)</th>
                                                    <th>Timer</th>
                                                    <th>Current Cost</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {multipleHandlers.map((handler, index) => {
                                                    const currentTimer = getHandlerCurrentTimer(handler.id);
                                                    const currentCost = calculateHandlerCost(handler);
                                                    const isTimerActive = activeHandlerTimers[handler.id];
                                                    
                                                    return (
                                                        <tr key={handler.id} className={handler.status === 'completed' ? 'table-success' : handler.status === 'inprogress' ? 'table-warning' : ''}>
                                                            <td className="text-center">{index + 1}</td>
                                                            <td><strong>{handler.name}</strong></td>
                                                            <td className="text-center">₹{handler.amount}</td>
                                                            <td>
                                                                <span className="font-monospace timer-display">
                                                                    {formatTime(currentTimer)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="fw-bold text-success">₹{currentCost}</span>
                                                            </td>
                                                            <td>
                                                                <div className="btn-group btn-group-sm">
                                                                    {handler.status === 'initiate' && (
                                                                        <button
                                                                            className="btn btn-success"
                                                                            onClick={() => startHandlerTimer(handler.id)}
                                                                            title="Start Handler"
                                                                        >
                                                                            <i className="fa-solid fa-play"></i>
                                                                        </button>
                                                                    )}
                                                                    {handler.status === 'inprogress' && (
                                                                        <>
                                                                            <button
                                                                                className="btn btn-warning"
                                                                                onClick={() => pauseHandlerTimer(handler.id)}
                                                                                title="Pause Handler"
                                                                            >
                                                                                <i className="fa-solid fa-pause"></i>
                                                                            </button>
                                                                            <button
                                                                                className="btn btn-danger"
                                                                                onClick={() => stopHandlerTimer(handler.id)}
                                                                                title="Stop Handler"
                                                                            >
                                                                                <i className="fa-solid fa-stop"></i>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {handler.status === 'pending' && (
                                                                        <button
                                                                            className="btn btn-success"
                                                                            onClick={() => startHandlerTimer(handler.id)}
                                                                            title="Resume Handler"
                                                                        >
                                                                            <i className="fa-solid fa-play"></i>
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        className="btn btn-outline-danger"
                                                                        onClick={() => removeMultipleHandler(handler.id)}
                                                                        title="Remove Handler"
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Handlers Summary */}
                                {multipleHandlers.length > 0 && (
                                    <div className="card mt-3 border-warning">
                                        <div className="card-body">
                                            <div className="row">
                                                <div className="col-md-6">
                                                    <p><strong>Total Handlers:</strong> {multipleHandlers.length}</p>
                                                    <p><strong>Total Amount Rate:</strong> ₹{multipleHandlers.reduce((sum, handler) => sum + (handler.amount || 0), 0)}/min</p>
                                                </div>
                                                <div className="col-md-6">
                                                    <p><strong>Completed:</strong> {multipleHandlers.filter(h => h.status === 'completed').length}</p>
                                                    <p><strong>In Progress:</strong> {multipleHandlers.filter(h => h.status === 'inprogress').length}</p>
                                                </div>
                                                <div className="col-md-12 mt-2">
                                                    <div className="alert alert-warning mb-0">
                                                        <strong><i className="fa-solid fa-calculator me-2"></i>Process Total:</strong> 
                                                        <div className="mt-1">
                                                            <strong>Time:</strong> {formatTime(multipleHandlers.reduce((sum, handler) => 
                                                                sum + (handlerElapsedTimes[handler.id] || handler.elapsedTime || 0), 0))}
                                                        </div>
                                                        <div>
                                                            <strong>Cost:</strong> ₹{multipleHandlers.reduce((sum, handler) => {
                                                                const handlerElapsed = handlerElapsedTimes[handler.id] || handler.elapsedTime || 0;
                                                                return sum + ((handler.amount || 0) * (handlerElapsed / 60000));
                                                            }, 0).toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeMultipleHandlersModal}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-primary" onClick={saveMultipleHandlers}>
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Template Modal */}
            {showGlobalTemplateModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-database me-2"></i>
                                    Global Templates - {activeProductionDepartment}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => {
                                    setShowGlobalTemplateModal(false);
                                    setGlobalTemplateAction("new");
                                    setSelectedExistingTemplate(null);
                                    setNewGlobalTemplate({
                                        name: "",
                                        description: "",
                                        category: "",
                                        template_data: [],
                                        is_public: true
                                    });
                                }}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3 border-primary">
                                    <div className="card-header bg-light">
                                        <h6>Add New Global Template</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="text"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Template Name"
                                                        value={newGlobalTemplate.name}
                                                        onChange={(e) => setNewGlobalTemplate(prev => ({ ...prev, name: e.target.value }))}
                                                    />
                                                    <label>Template Name *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="text"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Category"
                                                        value={newGlobalTemplate.category}
                                                        onChange={(e) => setNewGlobalTemplate(prev => ({ ...prev, category: e.target.value }))}
                                                    />
                                                    <label>Category</label>
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="form-floating mb-3">
                                                    <textarea
                                                        className="form-control bmr-form-control"
                                                        placeholder="Description"
                                                        value={newGlobalTemplate.description}
                                                        onChange={(e) => setNewGlobalTemplate(prev => ({ ...prev, description: e.target.value }))}
                                                        style={{ height: '100px' }}
                                                    />
                                                    <label>Description</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-check form-switch">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        checked={newGlobalTemplate.is_public}
                                                        onChange={(e) => setNewGlobalTemplate(prev => ({ ...prev, is_public: e.target.checked }))}
                                                        id="isPublicSwitch"
                                                    />
                                                    <label className="form-check-label" htmlFor="isPublicSwitch">
                                                        Public Template (Visible to all departments)
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="d-flex gap-2">
                                                    <button 
                                                        className="btn btn-primary"
                                                        onClick={addGlobalTemplate}
                                                        disabled={!newGlobalTemplate.name.trim() || !selectedBMR?.templateData?.length}
                                                    >
                                                        <i className="fa-solid fa-plus me-2"></i>
                                                        Save as New Template
                                                    </button>
                                                    <button 
                                                        className="btn btn-outline-primary"
                                                        onClick={() => setGlobalTemplateAction("existing")}
                                                        disabled={!selectedBMR?.templateData?.length}
                                                    >
                                                        <i className="fa-solid fa-save me-2"></i>
                                                        Save to Existing Template
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5 className="mb-3">Available Global Templates</h5>
                                {globalTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        <i className="fa-solid fa-database fa-2x mb-3"></i>
                                        <p>No global templates found. Create your first template above.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Template Name</th>
                                                    <th>Category</th>
                                                    <th>Description</th>
                                                    <th>Items</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {globalTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td className="text-center">{index + 1}</td>
                                                        <td>
                                                            <strong>{template.name}</strong>
                                                            {template.is_public && (
                                                                <span className="badge bg-success ms-2">Public</span>
                                                            )}
                                                        </td>
                                                        <td>{template.category}</td>
                                                        <td>{template.description || 'No description'}</td>
                                                        <td className="text-center">
                                                            <span className="badge bg-primary">
                                                                {template.template_data?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => viewGlobalTemplate(template)}
                                                                    title="View Template"
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => loadGlobalTemplate(template)}
                                                                    disabled={!selectedBMR}
                                                                    title="Load into BMR"
                                                                >
                                                                    <i className="fa-solid fa-download"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => deleteGlobalTemplate(template.id)}
                                                                    title="Delete Template"
                                                                >
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => {
                                    setShowGlobalTemplateModal(false);
                                    setGlobalTemplateAction("new");
                                    setSelectedExistingTemplate(null);
                                    setNewGlobalTemplate({
                                        name: "",
                                        description: "",
                                        category: "",
                                        template_data: [],
                                        is_public: true
                                    });
                                }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Global Template Modal */}
            {showViewGlobalTemplateModal && selectedGlobalTemplate && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-info text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-eye me-2"></i>
                                    View Template - {selectedGlobalTemplate.name}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowViewGlobalTemplateModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Template Name:</strong> {selectedGlobalTemplate.name}</p>
                                                <p><strong>Category:</strong> {selectedGlobalTemplate.category}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Department:</strong> {selectedGlobalTemplate.department || 'All'}</p>
                                                <p><strong>Public:</strong> {selectedGlobalTemplate.is_public ? 'Yes' : 'No'}</p>
                                            </div>
                                            <div className="col-md-12">
                                                <p><strong>Description:</strong> {selectedGlobalTemplate.description}</p>
                                                <p><strong>Total Items:</strong> {selectedGlobalTemplate.template_data?.length || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5>Template Data</h5>
                                {selectedGlobalTemplate.template_data?.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Raw Material</th>
                                                    <th>Part No</th>
                                                    <th>Internal Serial No</th>
                                                    <th>Description</th>
                                                    <th>Qty</th>
                                                    <th>Price (₹)</th>
                                                    <th>Total (₹)</th>
                                                    <th>Issued By</th>
                                                    <th>Received By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedGlobalTemplate.template_data.map((item, index) => {
                                                    const total = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                                                    return (
                                                        <tr key={index}>
                                                            <td className="text-center">{index + 1}</td>
                                                            <td>{item.rawMaterial || ''}</td>
                                                            <td>{item.partNo || ''}</td>
                                                            <td>{item.internalSerialNo || ''}</td>
                                                            <td>{item.description || ''}</td>
                                                            <td className="text-center">{parseFloat(item.quantity || 1).toFixed(2)}</td>
                                                            <td className="text-end">₹{parseFloat(item.price || 0).toFixed(2)}</td>
                                                            <td className="text-end fw-bold text-success">₹{total.toFixed(2)}</td>
                                                            <td>{item.issuedBy || 'N/A'}</td>
                                                            <td>{item.receivedBy || 'N/A'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        No template data available.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowViewGlobalTemplateModal(false)}>
                                    Close
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => loadGlobalTemplate(selectedGlobalTemplate)}
                                    disabled={!selectedBMR}
                                >
                                    <i className="fa-solid fa-download me-2"></i>
                                    Load into Current BMR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Process Template Modal */}
            {showProcessTemplateModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-warning text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-gear me-2"></i>
                                    Process Templates - {activeProductionDepartment}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowProcessTemplateModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3 border-warning">
                                    <div className="card-header bg-light">
                                        <h6>Add New Process Template</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="text"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Handler Name"
                                                        value={newProcessTemplate.handler_name}
                                                        onChange={(e) => setNewProcessTemplate(prev => ({ ...prev, handler_name: e.target.value }))}
                                                    />
                                                    <label>Handler Name *</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="number"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Amount per minute"
                                                        value={newProcessTemplate.amount}
                                                        onChange={(e) => setNewProcessTemplate(prev => ({ ...prev, amount: e.target.value }))}
                                                        step="0.01"
                                                    />
                                                    <label>Amount per minute (₹) *</label>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="btn btn-primary" onClick={addProcessTemplate}>
                                            <i className="fa-solid fa-plus me-2"></i>
                                            Add Template
                                        </button>
                                    </div>
                                </div>

                                <h5 className="mb-3">Existing Templates</h5>
                                {processTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        <i className="fa-solid fa-gear fa-2x mb-3"></i>
                                        <p>No process templates found. Add your first template above.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Handler Name</th>
                                                    <th>Amount (₹/min)</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {processTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td className="text-center">{index + 1}</td>
                                                        <td>
                                                            <strong>{template.handler_name}</strong>
                                                        </td>
                                                        <td className="text-end">₹{template.amount}</td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => deleteProcessTemplate(template.id)}
                                                                title="Delete Template"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowProcessTemplateModal(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Saved Template Modal for Individual BMR */}
            {selectedSavedTemplate && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-info text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-folder-open me-2"></i>
                                    Saved Template - {selectedSavedTemplate.name}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setSelectedSavedTemplate(null)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-12">
                                        <div className="card mb-3">
                                            <div className="card-body">
                                                <h6>Template Information</h6>
                                                <div className="row">
                                                    <div className="col-md-6">
                                                        <p><strong>Product:</strong> {selectedSavedTemplate.productName}</p>
                                                        <p><strong>Assembly:</strong> {selectedSavedTemplate.assemblyName}</p>
                                                    </div>
                                                    <div className="col-md-6">
                                                        <p><strong>Saved:</strong> {new Date(selectedSavedTemplate.savedAt).toLocaleString()}</p>
                                                        <p><strong>Items:</strong> {selectedSavedTemplate.templateData?.length || 0}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <h5>Template Data</h5>
                                        {selectedSavedTemplate.templateData?.length > 0 ? (
                                            <div className="table-responsive">
                                                <table className="table bmr-table table-hover">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Raw Material</th>
                                                            <th>Part No</th>
                                                            <th>Internal Serial No</th>
                                                            <th>Description</th>
                                                            <th>Qty</th>
                                                            <th>Price</th>
                                                            <th>Issued By</th>
                                                            <th>Received By</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedSavedTemplate.templateData?.map((item, index) => (
                                                            <tr key={index}>
                                                                <td className="text-center">{index + 1}</td>
                                                                <td>{item.rawMaterial || 'N/A'}</td>
                                                                <td>{item.partNo || 'N/A'}</td>
                                                                <td>{item.internalSerialNo || 'N/A'}</td>
                                                                <td>{item.description || 'N/A'}</td>
                                                                <td className="text-center">{parseFloat(item.quantity || 1).toFixed(2)}</td>
                                                                <td className="text-end">₹{item.price || 0}</td>
                                                                <td>{item.issuedBy || 'N/A'}</td>
                                                                <td>{item.receivedBy || 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="alert alert-info text-center">
                                                No template data available.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setSelectedSavedTemplate(null)}
                                >
                                    Close
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => loadSavedTemplate(selectedSavedTemplate)}
                                    disabled={!selectedBMR}
                                >
                                    <i className="fa-solid fa-download me-2"></i>
                                    Load this Template
                                </button>
                                <button
                                    className="btn btn-outline-danger"
                                    onClick={() => {
                                        showConfirmation({
                                            title: "Delete Saved Template",
                                            message: "Are you sure you want to delete this saved template?",
                                            confirmText: "Delete",
                                            cancelText: "Cancel",
                                            onConfirm: () => {
                                                deleteSavedTemplate(selectedSavedTemplate.id);
                                                setSelectedSavedTemplate(null);
                                            },
                                            onCancel: () => {}
                                        });
                                    }}
                                >
                                    <i className="fa-solid fa-trash me-2"></i>
                                    Delete Template
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BMR History Modal with Filters */}
            {showHistoryModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-history me-2"></i>
                                    BMR History - {activeProductionDepartment}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setShowHistoryModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* Filter Section */}
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <select
                                                        className="form-select bmr-form-control"
                                                        value={historyFilter.assemblyType}
                                                        onChange={(e) => setHistoryFilter(prev => ({ ...prev, assemblyType: e.target.value }))}
                                                    >
                                                        <option value="all">All Assemblies</option>
                                                        <option value="main">Main Assembly Only</option>
                                                        <option value="sub">Sub Assembly Only</option>
                                                        <option value="assembly">Simple Assembly Only</option>
                                                    </select>
                                                    <label>Filter by Assembly Type</label>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="text"
                                                        className="form-control bmr-form-control"
                                                        placeholder="Search BMR, Product, Assembly..."
                                                        value={historyFilter.searchTerm}
                                                        onChange={(e) => setHistoryFilter(prev => ({ ...prev, searchTerm: e.target.value }))}
                                                    />
                                                    <label>Search History</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {getFilteredHistory().length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        <i className="fa-solid fa-history fa-2x mb-3"></i>
                                        <p>No BMR history found matching your criteria.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>BMR Name</th>
                                                    <th>Initial Code</th>
                                                    <th>Product</th>
                                                    <th>Assembly</th>
                                                    <th>Items</th>
                                                    <th>Completed Date</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getFilteredHistory().map((history, index) => (
                                                    <tr key={history.id}>
                                                        <td className="text-center">{index + 1}</td>
                                                        <td>
                                                            <strong>{history.bmr_name}</strong>
                                                        </td>
                                                        <td>
                                                            <span className="badge bg-primary">{history.initial_code}</span>
                                                        </td>
                                                        <td>{history.product_name}</td>
                                                        <td>{history.assembly_name}</td>
                                                        <td className="text-center">
                                                            <span className="badge bg-primary">
                                                                {history.template_data?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {new Date(history.completed_at).toLocaleString()}
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary"
                                                                    onClick={() => viewHistoryItem(history)}
                                                                    title="View Details"
                                                                >
                                                                    <i className="fa-solid fa-eye me-1"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success"
                                                                    onClick={() => printHistoryItem(history)}
                                                                    title="Print"
                                                                >
                                                                    <i className="fa-solid fa-print me-1"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => deleteHistoryItem(history.id)}
                                                                    title="Delete"
                                                                >
                                                                    <i className="fa-solid fa-trash me-1"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setShowHistoryModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Item Detail Modal */}
            {selectedHistoryItem && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-info text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-file-invoice me-2"></i>
                                    History Details - {selectedHistoryItem.bmr_name}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setSelectedHistoryItem(null)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Product:</strong> {selectedHistoryItem.product_name}</p>
                                                <p><strong>Assembly:</strong> {selectedHistoryItem.assembly_name}</p>
                                                <p><strong>Initial Code:</strong> {selectedHistoryItem.initial_code}</p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Department:</strong> {selectedHistoryItem.department}</p>
                                                <p><strong>Completed:</strong> {new Date(selectedHistoryItem.completed_at).toLocaleString()}</p>
                                                <p><strong>Total Items:</strong> {selectedHistoryItem.template_data?.length || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h5>Template Data</h5>
                                {selectedHistoryItem.template_data?.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table bmr-table table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Raw Material</th>
                                                    <th>Part No</th>
                                                    <th>Internal Serial No</th>
                                                    <th>Description</th>
                                                    <th>Qty</th>
                                                    <th>Price</th>
                                                    <th>Total</th>
                                                    <th>Issued By</th>
                                                    <th>Received By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedHistoryItem.template_data.map((item, index) => {
                                                    const total = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                                                    return (
                                                        <tr key={index}>
                                                            <td className="text-center">{index + 1}</td>
                                                            <td>{item.rawMaterial || ''}</td>
                                                            <td>{item.partNo || ''}</td>
                                                            <td>{item.internalSerialNo || ''}</td>
                                                            <td>{item.description || ''}</td>
                                                            <td className="text-center">{parseFloat(item.quantity || 1).toFixed(2)}</td>
                                                            <td className="text-end">₹{parseFloat(item.price || 0).toFixed(2)}</td>
                                                            <td className="text-end fw-bold text-success">₹{total.toFixed(2)}</td>
                                                            <td>{item.issuedBy || 'N/A'}</td>
                                                            <td>{item.receivedBy || 'N/A'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="alert alert-info text-center">
                                        No template data available.
                                    </div>
                                )}

                                {selectedHistoryItem.processes_data?.length > 0 && (
                                    <>
                                        <h5 className="mt-4">Process Details</h5>
                                        <div className="table-responsive">
                                            <table className="table bmr-table table-hover">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Process Name</th>
                                                        <th>Total Cost (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedHistoryItem.processes_data.map((process, index) => {
                                                        let totalCost = 0;
                                                        if (process.handlers && process.handlers.length > 0) {
                                                            totalCost = process.handlers.reduce((hSum, handler) => 
                                                                hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                                                        } else {
                                                            totalCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                                        }
                                                        return (
                                                            <tr key={index}>
                                                                <td><strong>{process.name}</strong></td>
                                                                <td className="text-end fw-bold text-success">₹{totalCost.toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    onClick={() => setSelectedHistoryItem(null)}
                                >
                                    Close
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => printHistoryItem(selectedHistoryItem)}
                                >
                                    <i className="fa-solid fa-print me-2"></i>
                                    Print
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Completion Modal with decimal support */}
            {showCompletionModal && (
                <div className="modal fade show bmr-modal" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content shadow-lg">
                            <div className="modal-header bg-success text-white">
                                <h5 className="modal-title">
                                    <i className="fa-solid fa-check-circle me-2"></i>
                                    Complete BMR - {completedBMR?.name}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCompletionModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="alert alert-success">
                                    <i className="fa-solid fa-check-circle me-2"></i>
                                    All processes completed successfully! The finished product will be moved to stock.
                                </div>
                                
                                {/* Price Summary Section */}
                                <div className="card mb-3">
                                    <div className="card-header bg-info text-white">
                                        <h6 className="mb-0">Price Calculation Summary</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <p><strong>Template Items Total:</strong> 
                                                    ₹{completedBMR?.templateData?.reduce((sum, item) => {
                                                        return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                                                    }, 0).toFixed(2) || '0.00'}
                                                </p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>Process Costs Total:</strong> 
                                                    ₹{getBMRProcesses(completedBMR?.id).reduce((sum, process) => {
                                                        let processCost = 0;
                                                        if (process.handlers && process.handlers.length > 0) {
                                                            processCost = process.handlers.reduce((hSum, handler) => 
                                                                hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                                                        } else {
                                                            processCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                                        }
                                                        return sum + processCost;
                                                    }, 0).toFixed(2) || '0.00'}
                                                </p>
                                            </div>
                                            <div className="col-md-12">
                                                <div className="alert alert-warning mb-0">
                                                    <h6 className="mb-1">Total Product Price:</h6>
                                                    <h4 className="mb-0">
                                                        ₹{(completedBMR?.templateData?.reduce((sum, item) => {
                                                            return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1);
                                                        }, 0) + getBMRProcesses(completedBMR?.id).reduce((sum, process) => {
                                                            let processCost = 0;
                                                            if (process.handlers && process.handlers.length > 0) {
                                                                processCost = process.handlers.reduce((hSum, handler) => 
                                                                    hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                                                            } else {
                                                                processCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                                            }
                                                            return sum + processCost;
                                                        }, 0)).toFixed(2) || '0.00'}
                                                    </h4>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="BareCode"
                                                value={newCompletedProduct.BareCode}
                                                onChange={(e) => setNewCompletedProduct(prev => ({ ...prev, BareCode: e.target.value }))}
                                            />
                                            <label>BareCode *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="PartNo"
                                                value={newCompletedProduct.PartNo}
                                                onChange={(e) => setNewCompletedProduct(prev => ({ ...prev, PartNo: e.target.value }))}
                                            />
                                            <label>PartNo *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="LotNo"
                                                value={newCompletedProduct.LotNo}
                                                onChange={(e) => setNewCompletedProduct(prev => ({ ...prev, LotNo: e.target.value }))}
                                            />
                                            <label>LotNo</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="S.No"
                                                value={newCompletedProduct.SNo}
                                                onChange={(e) => setNewCompletedProduct(prev => ({ ...prev, SNo: e.target.value }))}
                                            />
                                            <label>S.No (Auto-filled from BMR)</label>
                                        </div>
                                    </div>
                                    <div className="col-md-8">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="Product Name"
                                                value={newCompletedProduct.name}
                                                onChange={(e) => setNewCompletedProduct(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                            <label>Product Name *</label>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control bmr-form-control"
                                                placeholder="Quantity"
                                                value={newCompletedProduct.Quantity}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                                    const parts = value.split('.');
                                                    if (parts.length <= 2) {
                                                        setNewCompletedProduct(prev => ({ ...prev, Quantity: value }));
                                                    }
                                                }}
                                                pattern="[0-9]*\.?[0-9]{0,2}"
                                                title="Enter decimal quantity (e.g., 2.5)"
                                            />
                                            <label>Quantity *</label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="alert alert-warning">
                                    <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                    <strong>Note:</strong> 
                                    <ul className="mb-0 mt-2">
                                        <li>Stock quantities will be automatically reduced based on the BMR template data.</li>
                                        <li>If product already exists in stock, quantity will be updated (no duplicate entries).</li>
                                        <li>BMR will be saved to history and marked as complete.</li>
                                        <li>Price includes template materials + process costs.</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCompletionModal(false)}>
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-success"
                                    onClick={handleCompleteBMR}
                                    disabled={!newCompletedProduct.BareCode || !newCompletedProduct.PartNo || !newCompletedProduct.name}
                                >
                                    <i className="fa-solid fa-warehouse me-2"></i>
                                    Move to Stock & Complete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Product Modal */}
            <div className="modal fade" id="editProductModal" tabIndex="-1" aria-labelledby="editProductModalLabel" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content bmr-modal">
                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title" id="editProductModalLabel">Edit Product</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control bmr-form-control"
                                    placeholder="Product Name"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                />
                                <label>Product Name</label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" className="btn btn-primary" onClick={saveEditProduct}>Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Assembly Modal */}
            <div className="modal fade" id="editAssemblyModal" tabIndex="-1" aria-labelledby="editAssemblyModalLabel" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content bmr-modal">
                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title" id="editAssemblyModalLabel">Edit Assembly</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control bmr-form-control"
                                    placeholder="Assembly Name"
                                    value={newAssemblyName}
                                    onChange={(e) => setNewAssemblyName(e.target.value)}
                                />
                                <label>Assembly Name</label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" className="btn btn-primary" onClick={saveEditAssembly}>Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit BMR Modal */}
            <div className="modal fade" id="editBMRModal" tabIndex="-1" aria-labelledby="editBMRModalLabel" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content bmr-modal">
                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title" id="editBMRModalLabel">Edit BMR</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control bmr-form-control"
                                    placeholder="BMR Name"
                                    value={newBMR.name}
                                    onChange={(e) => setNewBMR(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <label>BMR Name</label>
                            </div>
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control bmr-form-control"
                                    placeholder="Initial Code"
                                    value={newBMR.initialCode}
                                    onChange={(e) => setNewBMR(prev => ({ ...prev, initialCode: e.target.value }))}
                                />
                                <label>Initial Code</label>
                            </div>
                            <div className="form-floating mb-3">
                                <select
                                    className="form-select bmr-form-control"
                                    value={newBMR.type}
                                    onChange={(e) => setNewBMR(prev => ({ ...prev, type: e.target.value }))}
                                >
                                    <option value="assembly">Assembly</option>
                                    <option value="main">Main</option>
                                    <option value="sub">Sub</option>
                                </select>
                                <label>BMR Type</label>
                            </div>
                            <div className="form-floating mb-3">
                                <select
                                    className="form-select bmr-form-control"
                                    value={newBMR.status}
                                    onChange={(e) => setNewBMR(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="active">Active</option>
                                    <option value="inprogress">In Progress</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="complete">Complete</option>
                                </select>
                                <label>Status</label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" className="btn btn-primary" onClick={saveEditBMR}>Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BMR;