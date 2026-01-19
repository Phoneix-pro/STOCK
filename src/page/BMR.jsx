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
        Quantity: 1
    });

    // History State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [bmrHistory, setBmrHistory] = useState([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [historyFilter, setHistoryFilter] = useState({
        assemblyType: "all",
        searchTerm: ""
    });

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
                    amount: 0, // Price removed as requested
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
        if (!window.confirm('Are you sure you want to delete this global process template?')) return;

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
            amount: 0, // Price removed as requested
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
        setNewGlobalProcessTemplate(prev => ({
            ...prev,
            processes: prev.processes.filter((_, i) => i !== index)
        }));
        toast.success('Process removed from template!');
    };

    // Load BMR data from Supabase
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

                                        return {
                                            id: template.id,
                                            name: template.name,
                                            type: template.type,
                                            initialCode: template.initial_code,
                                            status: template.status,
                                            department: template.department,
                                            productId: product.id,
                                            assemblyId: assembly.id,
                                            templateData: (templateData || []).map(item => ({
                                                id: item.id,
                                                rawMaterial: item.raw_material,
                                                partNo: item.part_no,
                                                internalSerialNo: item.internal_serial_no,
                                                description: item.description,
                                                assemblyName: item.assembly_name,
                                                quantity: item.quantity,
                                                price: item.price,
                                                issuedBy: item.issued_by,
                                                receivedBy: item.received_by,
                                                variantDetails: item.variant_details
                                            }))
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
        } catch (error) {
            toast.error('Error loading global template: ' + error.message);
        }
    };

    // Delete global template
    const deleteGlobalTemplate = async (templateId) => {
        if (!window.confirm('Are you sure you want to delete this global template?')) return;

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
        if (!window.confirm('Are you sure you want to delete this process template?')) return;

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
    };

    // Load processes
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
        if (!window.confirm('Are you sure you want to delete this product?')) return;

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
    };

    // Add assembly to product in Supabase
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
                assemblyName = `ASSEMBLY ${Date.now().toString().slice(-4)}`;
            } else {
                if (type === "main") {
                    assemblyName = "MAIN ASSEMBLY";
                } else if (type === "sub") {
                    assemblyName = `SUB ASSEMBLY ${Date.now().toString().slice(-4)}`;
                } else {
                    assemblyName = `ASSEMBLY ${Date.now().toString().slice(-4)}`;
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
        if (!window.confirm('Are you sure you want to delete this assembly?')) return;

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
        if (!window.confirm('Are you sure you want to delete this BMR?')) return;

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

    // Add product to BMR template in Supabase (accepting variants)
    const addProductToBMRTemplate = async (bmrId, productId, assemblyId) => {
        try {
            const newProductEntry = {
                raw_material: "",
                part_no: "",
                internal_serial_no: "",
                description: "",
                assembly_name: "",
                quantity: 1,
                price: 0,
                issued_by: "",
                received_by: "",
                variant_details: null
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
                quantity: data[0].quantity,
                price: data[0].price,
                issuedBy: data[0].issued_by,
                receivedBy: data[0].received_by,
                variantDetails: data[0].variant_details
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

    // Update BMR template product data in Supabase
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
                'variantDetails': 'variant_details'
            };

            const supabaseField = supabaseFieldMap[field] || field;
            const updateData = { [supabaseField]: value };

            const { error } = await supabase
                .from('bmr_template_data')
                .update(updateData)
                .eq('id', productToUpdate.id);

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
                                                ? {
                                                    ...bmr,
                                                    templateData: bmr.templateData.map((product, idx) =>
                                                        idx === productIndex
                                                            ? { ...product, [field]: value }
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
                            ? { ...product, [field]: value }
                            : product
                    )
                }));
            }
        } catch (error) {
            toast.error('Error updating template product: ' + error.message);
        }
    };

    // Print BMR Template with multiple barcodes support
    const printBMRTemplate = (bmr, includeProcesses = true) => {
        const printWindow = window.open('', '_blank');
        const templateData = bmr.templateData || [];
        const bmrProcesses = includeProcesses ? getBMRProcesses(bmr.id) : [];
        
        // Calculate totals
        const templateTotal = templateData.reduce((sum, item) => {
            return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
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
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .table th, .table td { border: 1px solid #000; padding: 8px; text-align: left; }
                        .table th { background-color: #f2f2f2; font-weight: bold; }
                        .no-data { text-align: center; padding: 20px; color: #666; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
                        .process-section { margin-top: 30px; }
                        .process-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        .process-table th, .process-table td { border: 1px solid #000; padding: 6px; text-align: left; }
                        .process-table th { background-color: #e9ecef; }
                        .total-section { margin-top: 30px; padding: 20px; background-color: #e9f7fe; border-radius: 5px; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                        .grand-total { font-size: 1.2em; font-weight: bold; color: #0d6efd; }
                        .handler-details { margin-left: 20px; font-size: 0.9em; }
                        .handler-row { border-bottom: 1px solid #ddd; padding: 4px 0; }
                        .barcode-details { font-size: 0.9em; color: #666; margin-top: 2px; }
                        .barcode-item { display: inline-block; margin-right: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Bill of Material Register</h1>
                        <h2>${bmr.name} - ${bmr.initialCode}</h2>
                        <p><strong>Department:</strong> ${activeProductionDepartment}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
                    </div>
                    
                    ${templateData.length > 0 ? `
                        <h3>Template Data</h3>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>S.NO</th>
                                    <th>RAW MATERIAL/PART/NAME/PRODUCT CODE</th>
                                    <th>PartNo/SKU</th>
                                    <th>INTERNAL SERIAL.NO (Barcodes)</th>
                                    <th>DESCRIPTION</th>
                                    <th>Qty</th>
                                    <th>Avg Price (₹)</th>
                                    <th>Total (₹)</th>
                                    <th>ISSUED BY</th>
                                    <th>RECEIVED BY</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${templateData.map((item, index) => {
                                    const totalQuantity = parseInt(item.quantity) || 1;
                                    const totalPrice = parseFloat(item.totalPrice) || (parseFloat(item.price) || 0) * totalQuantity;
                                    const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;
                                    const barcodes = item.internalSerialNo ? item.internalSerialNo.split(',').map(b => b.trim()) : [];
                                    
                                    // Parse variant details if available
                                    let variantDetails = [];
                                    if (item.variantDetails) {
                                        try {
                                            variantDetails = JSON.parse(item.variantDetails);
                                        } catch (e) {
                                            console.error('Error parsing variant details:', e);
                                        }
                                    }
                                    
                                    return `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${item.rawMaterial || ''}</td>
                                            <td>${item.partNo || ''}</td>
                                            <td>
                                                ${barcodes.map(barcode => `<div class="barcode-item">${barcode}</div>`).join('')}
                                                ${variantDetails.length > 0 ? `
                                                    <div class="barcode-details">
                                                        ${variantDetails.map(variant => `
                                                            <div>${variant.barcode}: ${variant.qty} × ₹${variant.price} = ₹${(variant.qty * variant.price).toFixed(2)}</div>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                            </td>
                                            <td>${item.description || ''}</td>
                                            <td>${item.quantity || 1}</td>
                                            <td>₹${averagePrice.toFixed(2)}</td>
                                            <td>₹${totalPrice.toFixed(2)}</td>
                                            <td>${item.issuedBy || ''}</td>
                                            <td>${item.receivedBy || ''}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="summary">
                            <p><strong>Total Items:</strong> ${templateData.length}</p>
                            <p><strong>Template Total:</strong> ₹${templateTotal.toFixed(2)}</p>
                        </div>
                    ` : `
                        <div class="no-data">
                            <p>No template data available for printing.</p>
                        </div>
                    `}
                    
                    ${includeProcesses && bmrProcesses.length > 0 ? `
                        <div class="process-section">
                            <h3>Process Details</h3>
                            <table class="process-table">
                                <thead>
                                    <tr>
                                        <th>Process Name</th>
                                        <th>Handler(s)</th>
                                        <th>Status</th>
                                        <th>Total Time</th>
                                        <th>Total Cost (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${bmrProcesses.map(process => {
                                        const handlers = process.handlers || [];
                                        const hasMultipleHandlers = handlers.length > 0;
                                        
                                        let totalProcessTime = 0;
                                        let totalProcessCost = 0;
                                        
                                        if (hasMultipleHandlers) {
                                            handlers.forEach(handler => {
                                                totalProcessTime += handler.elapsedTime || 0;
                                                totalProcessCost += (handler.amount || 0) * ((handler.elapsedTime || 0) / 60000);
                                            });
                                        } else {
                                            totalProcessTime = process.elapsedTime || 0;
                                            totalProcessCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                        }
                                        
                                        return `
                                            <tr>
                                                <td><strong>${process.name}</strong></td>
                                                <td>
                                                    ${hasMultipleHandlers ? 
                                                        handlers.map((handler, idx) => `
                                                            <div class="handler-row">
                                                                <strong>${handler.name}</strong> 
                                                                (₹${handler.amount}/min)<br/>
                                                                Time: ${formatTime(handler.elapsedTime || 0)} | 
                                                                Cost: ₹${((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)).toFixed(2)} |
                                                                Status: ${handler.status || 'initiate'}
                                                            </div>
                                                        `).join('') :
                                                        (process.handler || 'N/A')
                                                    }
                                                </td>
                                                <td>${process.status}</td>
                                                <td>${formatTime(totalProcessTime)}</td>
                                                <td>₹${totalProcessCost.toFixed(2)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3"><strong>Total Process Summary</strong></td>
                                        <td><strong>${formatTime(bmrProcesses.reduce((sum, process) => {
                                            if (process.handlers && process.handlers.length > 0) {
                                                return sum + process.handlers.reduce((hSum, handler) => hSum + (handler.elapsedTime || 0), 0);
                                            }
                                            return sum + (process.elapsedTime || 0);
                                        }, 0))}</strong></td>
                                        <td><strong>₹${bmrProcesses.reduce((sum, process) => {
                                            if (process.handlers && process.handlers.length > 0) {
                                                return sum + process.handlers.reduce((hSum, handler) => 
                                                    hSum + ((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)), 0);
                                            }
                                            return sum + ((process.amount || 0) * ((process.elapsedTime || 0) / 60000));
                                        }, 0).toFixed(2)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ` : ''}

                    <div class="total-section">
                        <h3>Total Price Calculation</h3>
                        <div class="total-row">
                            <span>Template Items Total:</span>
                            <span>₹${templateTotal.toFixed(2)}</span>
                        </div>
                        ${includeProcesses && bmrProcesses.length > 0 ? `
                            <div class="total-row">
                                <span>Process Costs Total:</span>
                                <span>₹${processTotal.toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="total-row grand-total">
                            <span>Grand Total Product Price:</span>
                            <span>₹${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
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
                    quantity: item.quantity || 1,
                    price: item.price || 0,
                    issued_by: item.issuedBy || '',
                    received_by: item.receivedBy || '',
                    variant_details: item.variantDetails || null
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
        if (window.confirm('Are you sure you want to delete this saved template?')) {
            const updatedTemplates = { ...savedTemplates };
            delete updatedTemplates[bmrId];
            setSavedTemplates(updatedTemplates);
            saveTemplatesToStorage(updatedTemplates);
            toast.success('Saved template deleted!');
        }
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
                amount: 0, // Price removed as requested
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
        if (!window.confirm('Are you sure you want to delete this process?')) return;

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
                    amount: 0, // Price removed as requested
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
            return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
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
            Quantity: 1
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
                amount: "0" // Price removed
            };
        });
    };

   // In BMR.js, update the handleCompleteBMR function
const handleCompleteBMR = async () => {
    if (!completedBMR) return;

    try {
        // 1. Calculate total price (template + processes)
        const templateTotal = completedBMR.templateData?.reduce((sum, item) => {
            return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
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

        // 4. FIXED: Release using_quantity (BMR is complete, so materials are consumed)
        for (const templateItem of completedBMR.templateData || []) {
            if (templateItem.internalSerialNo) {
                // Parse multiple barcodes if comma separated
                const barcodes = templateItem.internalSerialNo.split(',').map(b => b.trim());
                
                // Parse variant details if available
                let variantDetails = [];
                if (templateItem.variantDetails) {
                    try {
                        variantDetails = JSON.parse(templateItem.variantDetails);
                    } catch (e) {
                        console.error('Error parsing variant details:', e);
                    }
                }

                const totalQuantityNeeded = parseInt(templateItem.quantity) || 1;
                
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
                            const allocatedQty = variantDetail ? variantDetail.qty : 1;
                            
                            if (allocatedQty > 0) {
                                // FIXED: Check current using quantity and release it (not move back to quantity)
                                const currentUsingQty = variant.using_quantity || 0;
                                const newUsingQty = Math.max(0, currentUsingQty - allocatedQty);
                                
                                // Materials are consumed in BMR, so they don't go back to available quantity
                                await supabase
                                    .from('stock_variants')
                                    .update({
                                        using_quantity: newUsingQty,
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', variant.id);
                                
                                // Record consumption (no movement back to quantity)
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
                                    const stockUsingQty = stockData.using_quantity || 0;
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

        // 5. Add completed product to stock
        const completedProduct = {
            bare_code: newCompletedProduct.BareCode,
            part_no: newCompletedProduct.PartNo,
            lot_no: newCompletedProduct.LotNo,
            s_no: newCompletedProduct.SNo,
            name: newCompletedProduct.name,
            price: parseFloat(totalPrice) || 0,
            quantity: parseInt(newCompletedProduct.Quantity) || 1,
            using_quantity: 0
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
            // Product exists, update quantity
            const newQuantity = existingStock.quantity + completedProduct.quantity;
            const newTotalReceived = (existingStock.total_received || 0) + completedProduct.quantity;
            
            // Calculate new average price
            const totalExistingValue = existingStock.quantity * (existingStock.average_price || existingStock.price || 0);
            const newItemValue = completedProduct.quantity * completedProduct.price;
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
            completedProduct.average_price = completedProduct.price;
            completedProduct.total_received = completedProduct.quantity;
            
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
                        price: completedProduct.price,
                        quantity: completedProduct.quantity,
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
            Quantity: 1
        });

        // 9. Reload all data
        await loadAllData();
        
        toast.success(`BMR completed successfully! Product added to stock at price: ₹${totalPrice.toFixed(2)}`);
    } catch (error) {
        console.error('Error completing BMR:', error);
        toast.error('Error completing BMR: ' + error.message);
    }
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
            <div className="d-flex align-items-center mt-2">
                <button
                    className="btn btn-sm btn-outline-info me-2"
                    onClick={() => {
                        setGlobalTemplateAction("new");
                        setShowGlobalTemplateModal(true);
                    }}
                >
                    <i className="fa-solid fa-database me-1"></i>
                    Global Templates ({globalTemplates.length})
                </button>
                <button
                    className="btn btn-sm btn-outline-warning me-2"
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
                    className="btn btn-sm btn-outline-success me-2"
                    onClick={() => {
                        setGlobalTemplateAction("existing");
                        setShowGlobalTemplateModal(true);
                    }}
                >
                    <i className="fa-solid fa-save me-1"></i>
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

    // Print History Item with Processes
    const printHistoryItem = (historyItem) => {
        const printWindow = window.open('', '_blank');
        const templateData = historyItem.template_data || [];
        const processesData = historyItem.processes_data || [];
        
        const printContent = `
            <html>
                <head>
                    <title>BMR History - ${historyItem.bmr_name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .table th, .table td { border: 1px solid #000; padding: 8px; text-align: left; }
                        .table th { background-color: #f2f2f2; font-weight: bold; }
                        .no-data { text-align: center; padding: 20px; color: #666; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
                        .history-info { margin-bottom: 20px; padding: 15px; background-color: #e9f7fe; border-radius: 5px; }
                        .process-section { margin-top: 30px; }
                        .process-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        .process-table th, .process-table td { border: 1px solid #000; padding: 6px; text-align: left; }
                        .process-table th { background-color: #e9ecef; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Bill of Material Register - History</h1>
                        <h2>${historyItem.bmr_name} - ${historyItem.initial_code}</h2>
                    </div>
                    
                    <div class="history-info">
                        <p><strong>Product:</strong> ${historyItem.product_name}</p>
                        <p><strong>Assembly:</strong> ${historyItem.assembly_name}</p>
                        <p><strong>Department:</strong> ${historyItem.department}</p>
                        <p><strong>Completed:</strong> ${new Date(historyItem.completed_at).toLocaleString()}</p>
                    </div>
                    
                    ${templateData.length > 0 ? `
                        <h3>Template Data</h3>
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>S.NO</th>
                                    <th>RAW MATERIAL/PART/NAME/PRODUCT CODE</th>
                                    <th>PartNo/SKU</th>
                                    <th>INTERNAL SERIAL.NO</th>
                                    <th>DESCRIPTION</th>
                                    <th>Qty</th>
                                    <th>Price (₹)</th>
                                    <th>Total (₹)</th>
                                    <th>ISSUED BY</th>
                                    <th>RECEIVED BY</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${templateData.map((item, index) => {
                                    const total = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
                                    return `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${item.rawMaterial || ''}</td>
                                            <td>${item.partNo || ''}</td>
                                            <td>${item.internalSerialNo || ''}</td>
                                            <td>${item.description || ''}</td>
                                            <td>${item.quantity || 1}</td>
                                            <td>₹${parseFloat(item.price || 0).toFixed(2)}</td>
                                            <td>₹${total.toFixed(2)}</td>
                                            <td>${item.issuedBy || ''}</td>
                                            <td>${item.receivedBy || ''}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="summary">
                            <p><strong>Total Items:</strong> ${templateData.length}</p>
                            <p><strong>Grand Total:</strong> ₹${templateData.reduce((sum, item) => {
                                return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
                            }, 0).toFixed(2)}</p>
                        </div>
                    ` : `
                        <div class="no-data">
                            <p>No template data available in history.</p>
                        </div>
                    `}
                    
                    ${processesData.length > 0 ? `
                        <div class="process-section">
                            <h3>Process Details</h3>
                            <table class="process-table">
                                <thead>
                                    <tr>
                                        <th>Process Name</th>
                                        <th>Handler(s)</th>
                                        <th>Status</th>
                                        <th>Total Time</th>
                                        <th>Total Cost (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${processesData.map(process => {
                                        const handlers = process.handlers || [];
                                        const hasMultipleHandlers = handlers.length > 0;
                                        
                                        let totalProcessTime = 0;
                                        let totalProcessCost = 0;
                                        
                                        if (hasMultipleHandlers) {
                                            handlers.forEach(handler => {
                                                totalProcessTime += handler.elapsedTime || 0;
                                                totalProcessCost += (handler.amount || 0) * ((handler.elapsedTime || 0) / 60000);
                                            });
                                        } else {
                                            totalProcessTime = process.elapsedTime || 0;
                                            totalProcessCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                        }
                                        
                                        return `
                                            <tr>
                                                <td><strong>${process.name}</strong></td>
                                                <td>
                                                    ${hasMultipleHandlers ? 
                                                        handlers.map((handler, idx) => `
                                                            <div class="handler-row">
                                                                <strong>${handler.name}</strong> 
                                                                (₹${handler.amount}/min)<br/>
                                                                Time: ${formatTime(handler.elapsedTime || 0)} | 
                                                                Cost: ₹${((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)).toFixed(2)} |
                                                                Status: ${handler.status || 'initiate'}
                                                            </div>
                                                        `).join('') :
                                                        (process.handler || 'N/A')
                                                    }
                                                </td>
                                                <td>${process.status}</td>
                                                <td>${formatTime(totalProcessTime)}</td>
                                                <td>₹${totalProcessCost.toFixed(2)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    // Delete History Item
    const deleteHistoryItem = async (historyId) => {
        if (!window.confirm('Are you sure you want to delete this history record?')) return;

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

    // Modified BMR Template Table with multiple barcodes support
    const renderBMRTemplateTable = () => {
        return (
            <div className="mb-4">
                <h4 className="h5 text-primary">BMR Template Structure</h4>
                {selectedBMR.templateData && selectedBMR.templateData.length === 0 ? (
                    <div className="alert alert-warning text-center">
                        No products added to template yet. Click "Add Product to Template" to start building your BMR.
                    </div>
                ) : (
                    <table className="table table-striped table-hover table-bordered align-middle text-center border-secondary shadow-sm">
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
                                // Parse multiple barcodes if comma separated
                                const barcodes = product.internalSerialNo ? product.internalSerialNo.split(',').map(b => b.trim()) : [];
                                // Parse variant details if available
                                let variantDetails = [];
                                if (product.variantDetails) {
                                    try {
                                        variantDetails = JSON.parse(product.variantDetails);
                                    } catch (e) {
                                        console.error('Error parsing variant details:', e);
                                    }
                                }
                                
                                const totalQuantity = parseInt(product.quantity) || 1;
                                const totalPrice = parseFloat(product.totalPrice) || (parseFloat(product.price) || 0) * totalQuantity;
                                const averagePrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;

                                return (
                                    <tr key={product.id}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={product.rawMaterial || ''}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'rawMaterial', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                placeholder="Raw material"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={product.partNo || ''}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'partNo', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                placeholder="Part No"
                                            />
                                        </td>
                                        <td>
                                            <div className="multiple-barcodes-input">
                                                <textarea
                                                    className="form-control form-control-sm"
                                                    value={product.internalSerialNo || ''}
                                                    onChange={(e) => {
                                                        updateBMRTemplateProduct(selectedBMR.id, index, 'internalSerialNo', e.target.value, selectedProduct.id, selectedMainAssembly.id);
                                                    }}
                                                    placeholder="Enter multiple barcodes separated by commas"
                                                    rows="2"
                                                />
                                                {barcodes.length > 0 && (
                                                    <div className="small text-muted mt-1">
                                                        <strong>Barcodes:</strong> {barcodes.length} barcode(s)
                                                        {variantDetails.length > 0 && (
                                                            <div className="mt-1">
                                                                {variantDetails.map((variant, idx) => (
                                                                    <span key={idx} className="badge bg-info me-1">
                                                                        {variant.barcode}: {variant.qty} × ₹{variant.price}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={product.description || ''}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'description', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                placeholder="Description"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                value={product.quantity || 1}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'quantity', parseInt(e.target.value) || 1, selectedProduct.id, selectedMainAssembly.id)}
                                                min="1"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-control form-control-sm"
                                                value={averagePrice.toFixed(2)}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'price', parseFloat(e.target.value) || 0, selectedProduct.id, selectedMainAssembly.id)}
                                                placeholder="Average Price"
                                                step="0.01"
                                            />
                                        </td>
                                        <td>
                                            <div className="text-end">
                                                <strong>₹{totalPrice.toFixed(2)}</strong>
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={product.issuedBy || ''}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'issuedBy', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                placeholder="Issued by"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={product.receivedBy || ''}
                                                onChange={(e) => updateBMRTemplateProduct(selectedBMR.id, index, 'receivedBy', e.target.value, selectedProduct.id, selectedMainAssembly.id)}
                                                placeholder="Received by"
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={async () => {
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
                )}
            </div>
        );
    };

    if (!activeProductionDepartment) {
        return (
            <div className="container">
                <div className="alert alert-warning text-center">
                    <h4>No Production Department Selected</h4>
                    <p>Please select a production department from the Production page first.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <h1 className="display-5 text-primary">{getPageTitle()}</h1>
            
            {/* Status Section */}
            <div className="StatusP mb-4">
                <h5>Status :</h5>
                <span className="dot-status inprogress">In Progress</span>
                <span className="dot-status testing">Testing</span>
                <span className="dot-status complete">Complete</span>
                <button 
                    className="btn btn-outline-info btn-sm ms-3"
                    onClick={viewBMRHistory}
                >
                    <i className="fa-solid fa-history me-2"></i>
                    View History ({bmrHistory.length})
                </button>
                <button 
                    className="btn btn-outline-warning btn-sm ms-2"
                    onClick={() => setShowProcessTemplateModal(true)}
                >
                    <i className="fa-solid fa-gear me-2"></i>
                    Process Templates ({processTemplates.length})
                </button>
                <button 
                    className="btn btn-outline-primary btn-sm ms-2"
                    onClick={() => setShowGlobalProcessTemplateModal(true)}
                >
                    <i className="fa-solid fa-layer-group me-2"></i>
                    Global Process Templates ({globalProcessTemplates.length})
                </button>
                <button 
                    className="btn btn-outline-success btn-sm ms-2"
                    onClick={() => {
                        setGlobalTemplateAction("new");
                        setShowGlobalTemplateModal(true);
                    }}
                >
                    <i className="fa-solid fa-database me-2"></i>
                    Global Templates ({globalTemplates.length})
                </button>
            </div>

            {/* Products Section */}
            <div className="ProductsB mb-4">
                <div className="row">
                    {bmrProducts.map(product => (
                        <div key={product.id} className="col-md-4 mb-3">
                            <div className="card">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h6 className="card-title mb-0">{product.name}</h6>
                                        <div>
                                            <button
                                                className="btn btn-sm btn-outline-secondary me-1"
                                                onClick={() => startEditProduct(product)}
                                                data-bs-toggle="modal"
                                                data-bs-target="#editProductModal"
                                            >
                                                <i className="fa-solid fa-pen"></i>
                                            </button>
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => deleteProduct(product.id)}
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <small className="text-muted d-block mb-2">
                                        Assembly Type: {product.hasAssembly ? 'Main & Sub Assembly' : 'Simple Assemblies Only'}
                                    </small>
                                    
                                    {product.hasAssembly ? (
                                        <div className="Bbutton">
                                            <button 
                                                className="btn btn-dark btn-sm me-1"
                                                onClick={() => addAssembly(product.id, "main")}
                                            >
                                                MAIN ASSEMBLY
                                            </button>
                                            <button 
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() => addAssembly(product.id, "sub")}
                                            >
                                                SUB ASSEMBLY
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="Bbutton">
                                            <button 
                                                className="btn btn-dark btn-sm"
                                                onClick={() => addAssembly(product.id, "assembly")}
                                            >
                                                ADD ASSEMBLY
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Assemblies */}
                                    {product.assemblies.map(assembly => (
                                        <div key={assembly.id} className="mt-2 p-2 border rounded">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <strong>
                                                    {assembly.name} 
                                                    <small className="text-muted ms-2">
                                                        ({assembly.type === 'main' ? 'Main' : assembly.type === 'sub' ? 'Sub' : 'Assembly'})
                                                    </small>
                                                </strong>
                                                <div>
                                                    <button
                                                        className="btn btn-sm btn-outline-secondary me-1"
                                                        onClick={() => startEditAssembly(assembly)}
                                                        data-bs-toggle="modal"
                                                        data-bs-target="#editAssemblyModal"
                                                    >
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => deleteAssembly(product.id, assembly.id)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* BMRs for this assembly */}
                                            <div className="Bbutton mt-1">
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
                                                        >
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
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-outline-danger"
                                                                onClick={() => deleteBMR(bmr.id, product.id, assembly.id)}
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {/* Add BMR Form */}
                                            <div className="inputB mt-2">
                                                <div className="input-group input-group-sm">
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        placeholder="BMR Name"
                                                        value={newBMR.name}
                                                        onChange={(e) => setNewBMR(prev => ({ ...prev, name: e.target.value }))}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        placeholder="Initial Code"
                                                        value={newBMR.initialCode}
                                                        onChange={(e) => setNewBMR(prev => ({ ...prev, initialCode: e.target.value }))}
                                                    />
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => addBMR(product.id, assembly.id)}
                                                    >
                                                        + Add BMR
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add New Product */}
            <div className="inputB mb-4">
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="Add new product"
                        onKeyPress={(e) => e.key === 'Enter' && addNewProduct()}
                    />
                    <button className="btn btn-success" onClick={addNewProduct}>
                        <i className="fa-solid fa-plus me-2"></i>
                        Add Product
                    </button>
                </div>
            </div>

            {/* BMR Management Section */}
            {selectedProduct && selectedMainAssembly && selectedBMR && (
                <div className="container mt-4">
                    <h2 className="h3 text-secondary">
                        {selectedProduct.name} ({selectedMainAssembly.name}) - {selectedBMR.name}
                    </h2>
                    
                    <div className="d-flex justify-content-between align-items-center mb-3">
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
                                >
                                    Complete
                                </button>
                            </div>
                        </div>
                        <div>
                            <button
                                className="btn btn-sm btn-primary me-2"
                                onClick={() => addProductToBMRTemplate(selectedBMR.id, selectedProduct.id, selectedMainAssembly.id)}
                            >
                                + Add Product to Template
                            </button>
                            <button
                                className="btn btn-sm btn-info me-2"
                                onClick={() => saveBMRTemplate(selectedBMR.id, selectedProduct.id, selectedMainAssembly.id)}
                            >
                                <i className="fa-solid fa-save me-1"></i>
                                Save Template
                            </button>
                            <button
                                className="btn btn-sm btn-warning me-2"
                                onClick={() => openProcessModal(selectedBMR)}
                            >
                                <i className="fa-solid fa-gears me-1"></i>
                                Processes ({getBMRProcesses(selectedBMR.id).length})
                            </button>
                            <button
                                className="btn btn-sm btn-outline-info me-2"
                                onClick={() => viewSavedTemplate(selectedBMR.id)}
                            >
                                <i className="fa-solid fa-folder-open me-1"></i>
                                View Template
                            </button>
                            <button
                                className="btn btn-sm btn-outline-success me-2"
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

                    {/* BMR Template Table - Modified to accept multiple barcodes */}
                    {renderBMRTemplateTable()}
                </div>
            )}

            {/* Global Process Template Modal */} 
            {showGlobalProcessTemplateModal && (
                <div className="modal v fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {templateAction === "existing" ? "Save to Existing Template" : "Global Process Templates"} - {activeProductionDepartment}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => {
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
                                {templateAction === "existing" ? (
                                    <div className="card mb-3">
                                        <div className="card-header">
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
                                                                setTemplateAction("new");
                                                                setSelectedTemplateForProcess(null);
                                                            }}
                                                        >
                                                            Back to New Template
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="card mb-3">
                                        <div className="card-header">
                                            <h6>{selectedGlobalProcessTemplate ? 'View/Load Template' : 'Add New Global Process Template'}</h6>
                                        </div>
                                        <div className="card-body">
                                            {!selectedGlobalProcessTemplate ? (
                                                <div className="row">
                                                    <div className="col-md-8">
                                                        <div className="form-floating mb-3">
                                                            <input
                                                                type="text"
                                                                className="form-control"
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
                                                                className="form-control"
                                                                placeholder="Description"
                                                                value={newGlobalProcessTemplate.description}
                                                                onChange={(e) => setNewGlobalProcessTemplate(prev => ({ ...prev, description: e.target.value }))}
                                                                style={{ height: '100px' }}
                                                            />
                                                            <label>Description</label>
                                                        </div>
                                                    </div>

                                                    {/* Add Process to Template - REMOVED PRICE FIELD */}
                                                    <div className="col-md-12">
                                                        <div className="card mb-3">
                                                            <div className="card-header">
                                                                <h6>Add Process to Template</h6>
                                                            </div>
                                                            <div className="card-body">
                                                                <div className="row">
                                                                    <div className="col-md-12">
                                                                        <div className="form-floating mb-3">
                                                                            <input
                                                                                type="text"
                                                                                className="form-control"
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
                                                                <table className="table table-sm table-bordered">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>#</th>
                                                                            <th>Process Name</th>
                                                                            <th>Action</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {newGlobalProcessTemplate.processes.map((process, index) => (
                                                                            <tr key={index}>
                                                                                <td>{index + 1}</td>
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
                                                            <button 
                                                                className="btn btn-outline-primary"
                                                                onClick={() => setTemplateAction("existing")}
                                                                disabled={!selectedBMRForProcess || getBMRProcesses(selectedBMRForProcess.id).length === 0}
                                                            >
                                                                <i className="fa-solid fa-save me-2"></i>
                                                                Save to Existing Template
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <h6>{selectedGlobalProcessTemplate.name}</h6>
                                                    <p><strong>Description:</strong> {selectedGlobalProcessTemplate.description}</p>
                                                    <p><strong>Processes:</strong> {selectedGlobalProcessTemplate.processes?.length || 0}</p>
                                                    
                                                    {/* Show Template Processes */}
                                                    {selectedGlobalProcessTemplate.processes && selectedGlobalProcessTemplate.processes.length > 0 && (
                                                        <div className="mt-3">
                                                            <h6>Template Processes</h6>
                                                            <div className="table-responsive">
                                                                <table className="table table-sm table-bordered">
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
                                                                                <td>{process.name}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="mt-3">
                                                        <button
                                                            className="btn btn-primary me-2"
                                                            onClick={() => loadGlobalProcessTemplate(selectedGlobalProcessTemplate)}
                                                            disabled={!selectedBMRForProcess}
                                                        >
                                                            <i className="fa-solid fa-download me-2"></i>
                                                            Load into Current BMR
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setSelectedGlobalProcessTemplate(null)}
                                                        >
                                                            Back to List
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <h5>Available Global Process Templates</h5>
                                {globalProcessTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No global process templates found. Create your first template above.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Template Name</th>
                                                    <th>Description</th>
                                                    <th>Processes</th>
                                                    <th>Department</th>
                                                    <th>Created</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {globalProcessTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <strong>{template.name}</strong>
                                                            {template.is_public && (
                                                                <span className="badge bg-success ms-2">Public</span>
                                                            )}
                                                        </td>
                                                        <td>{template.description}</td>
                                                        <td>
                                                            <span className="badge bg-info">
                                                                {template.processes?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>{template.department || 'All'}</td>
                                                        <td>
                                                            {new Date(template.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => setSelectedGlobalProcessTemplate(template)}
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => loadGlobalProcessTemplate(template)}
                                                                    disabled={!selectedBMRForProcess}
                                                                >
                                                                    <i className="fa-solid fa-download"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
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

            {/* Process Management Modal with Multiple Handlers Support */}
            {showProcessModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    Process Management - {selectedBMRForProcess?.name}
                                    <span className="badge bg-secondary ms-2">
                                        {getBMRProcesses(selectedBMRForProcess?.id).length} Processes
                                    </span>
                                </h5>
                                <button type="button" className="btn-close" onClick={closeProcessModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <button 
                                            className="btn btn-primary btn-sm me-2"
                                            onClick={openAddProcessModal}
                                        >
                                            <i className="fa-solid fa-plus me-1"></i>
                                            Add New Process
                                        </button>
                                        <button 
                                            className="btn btn-info btn-sm me-2"
                                            onClick={() => {
                                                setTemplateAction("new");
                                                setShowGlobalProcessTemplateModal(true);
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
                                        <span className="badge bg-warning me-2">
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
                                    <table className="table table-striped table-hover table-bordered">
                                        <thead>
                                            <tr>
                                                <th>Process Name</th>
                                                <th>Handler(s)</th>
                                                <th>Status</th>
                                                <th>Timer</th>
                                                <th>Current Cost</th>
                                                <th>Total Time</th>
                                                <th>Total Cost (₹)</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getBMRProcesses(selectedBMRForProcess?.id).map(process => {
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
                                                    <tr key={process.id}>
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
                                                            <span className={`badge ${
                                                                process.status === 'initiate' ? 'bg-secondary' :
                                                                process.status === 'inprogress' ? 'bg-warning' :
                                                                process.status === 'pending' ? 'bg-info' :
                                                                'bg-success'
                                                            }`}>
                                                                {process.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="font-monospace">
                                                                {formatTime(totalProcessTime)}
                                                            </span>
                                                        </td>
                                                        <td>₹{totalProcessCost.toFixed(2)}</td>
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
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {getBMRProcesses(selectedBMRForProcess?.id).length === 0 && (
                                    <div className="alert alert-info text-center">
                                        No processes added yet. Click "Add New Process" or "Load Process Template" to create processes.
                                    </div>
                                )}

                                {/* Process Summary */}
                                {getBMRProcesses(selectedBMRForProcess?.id).length > 0 && (
                                    <div className="card mt-3">
                                        <div className="card-header bg-info text-white">
                                            <h6 className="mb-0">Process Summary</h6>
                                        </div>
                                        <div className="card-body">
                                            <div className="row">
                                                <div className="col-md-4">
                                                    <p><strong>Total Processes:</strong> {getBMRProcesses(selectedBMRForProcess?.id).length}</p>
                                                </div>
                                                <div className="col-md-4">
                                                    <p><strong>Total Handlers:</strong> {getBMRProcesses(selectedBMRForProcess?.id).reduce((sum, process) => 
                                                        sum + (process.handlers?.length || 0), 0)}</p>
                                                </div>
                                                <div className="col-md-4">
                                                    <p><strong>Completed:</strong> {getBMRProcesses(selectedBMRForProcess?.id).filter(p => p.status === 'completed').length}</p>
                                                </div>
                                                <div className="col-md-12">
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
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {newProcess.id ? 'Edit Process' : 'Add New Process'}
                                </h5>
                                <button type="button" className="btn-close" onClick={closeAddProcessModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-12">
                                        <div className="form-floating mb-3">
                                            <input
                                                type="text"
                                                className="form-control"
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
                                                className="form-select"
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
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    Multiple Handlers - {selectedProcessForMultipleHandlers?.name}
                                </h5>
                                <button type="button" className="btn-close" onClick={closeMultipleHandlersModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-header">
                                        <h6>Add New Handler</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-8">
                                                <div className="form-floating mb-3">
                                                    <select
                                                        className="form-select"
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
                                                        className="form-control"
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

                                <h5>Current Handlers ({multipleHandlers.length})</h5>
                                {multipleHandlers.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No handlers added yet. Add handlers from template above.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Handler Name</th>
                                                    <th>Amount (₹/min)</th>
                                                    <th>Timer</th>
                                                    <th>Current Cost</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {multipleHandlers.map((handler, index) => {
                                                    const currentTimer = getHandlerCurrentTimer(handler.id);
                                                    const currentCost = calculateHandlerCost(handler);
                                                    const isTimerActive = activeHandlerTimers[handler.id];
                                                    
                                                    return (
                                                        <tr key={handler.id}>
                                                            <td>{index + 1}</td>
                                                            <td>{handler.name}</td>
                                                            <td>₹{handler.amount}</td>
                                                            <td>
                                                                <span className="font-monospace">
                                                                    {formatTime(currentTimer)}
                                                                </span>
                                                            </td>
                                                            <td>₹{currentCost}</td>
                                                            <td>
                                                                <span className={`badge ${
                                                                    handler.status === 'initiate' ? 'bg-secondary' :
                                                                    handler.status === 'inprogress' ? 'bg-warning' :
                                                                    handler.status === 'pending' ? 'bg-info' :
                                                                    'bg-success'
                                                                }`}>
                                                                    {handler.status}
                                                                </span>
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
                                    <div className="card mt-3">
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
                                                        <strong>Process Total:</strong> 
                                                        <div>Time: {formatTime(multipleHandlers.reduce((sum, handler) => 
                                                            sum + (handlerElapsedTimes[handler.id] || handler.elapsedTime || 0), 0))}</div>
                                                        <div>Cost: ₹{multipleHandlers.reduce((sum, handler) => {
                                                            const handlerElapsed = handlerElapsedTimes[handler.id] || handler.elapsedTime || 0;
                                                            return sum + ((handler.amount || 0) * (handlerElapsed / 60000));
                                                        }, 0).toFixed(2)}</div>
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
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    {globalTemplateAction === "existing" ? "Save to Existing Template" : "Global Templates"} - {activeProductionDepartment}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => {
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
                                {globalTemplateAction === "existing" ? (
                                    <div className="card mb-3">
                                        <div className="card-header">
                                            <h6>Save to Existing Template</h6>
                                        </div>
                                        <div className="card-body">
                                            <div className="row">
                                                <div className="col-md-12">
                                                    <div className="form-floating mb-3">
                                                        <select
                                                            className="form-select"
                                                            value={selectedExistingTemplate?.id || ""}
                                                            onChange={(e) => {
                                                                const template = globalTemplates.find(t => t.id === e.target.value);
                                                                setSelectedExistingTemplate(template);
                                                                if (template) {
                                                                    setNewGlobalTemplate(prev => ({
                                                                        ...prev,
                                                                        template_data: selectedBMR?.templateData || []
                                                                    }));
                                                                }
                                                            }}
                                                        >
                                                            <option value="">-- Select Existing Template --</option>
                                                            {globalTemplates.map(template => (
                                                                <option key={template.id} value={template.id}>
                                                                    {template.name} ({template.category}) - {template.template_data?.length || 0} items
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <label>Select Template to Update</label>
                                                    </div>
                                                </div>
                                                {selectedExistingTemplate && (
                                                    <div className="col-md-12">
                                                        <div className="alert alert-info">
                                                            <p><strong>Selected Template:</strong> {selectedExistingTemplate.name}</p>
                                                            <p><strong>Current Items:</strong> {selectedExistingTemplate.template_data?.length || 0}</p>
                                                            <p><strong>New Items:</strong> {selectedBMR?.templateData?.length || 0}</p>
                                                            <p className="text-warning">
                                                                <i className="fa-solid fa-exclamation-triangle me-2"></i>
                                                                This will replace all existing data in the template with current BMR data.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="col-md-12">
                                                    <div className="d-flex gap-2">
                                                        <button 
                                                            className="btn btn-primary"
                                                            onClick={saveToExistingTemplate}
                                                            disabled={!selectedExistingTemplate}
                                                        >
                                                            <i className="fa-solid fa-save me-2"></i>
                                                            Save to Selected Template
                                                        </button>
                                                        <button 
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                setGlobalTemplateAction("new");
                                                                setSelectedExistingTemplate(null);
                                                            }}
                                                        >
                                                            Back to New Template
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="card mb-3">
                                        <div className="card-header">
                                            <h6>{selectedGlobalTemplate ? 'View/Use Template' : 'Add New Global Template'}</h6>
                                        </div>
                                        <div className="card-body">
                                            {!selectedGlobalTemplate ? (
                                                <div className="row">
                                                    <div className="col-md-6">
                                                        <div className="form-floating mb-3">
                                                            <input
                                                                type="text"
                                                                className="form-control"
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
                                                                className="form-control"
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
                                                                className="form-control"
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
                                            ) : (
                                                <div>
                                                    <h6>{selectedGlobalTemplate.name}</h6>
                                                    <p><strong>Category:</strong> {selectedGlobalTemplate.category}</p>
                                                    <p><strong>Description:</strong> {selectedGlobalTemplate.description}</p>
                                                    <p><strong>Items:</strong> {selectedGlobalTemplate.template_data?.length || 0}</p>
                                                    
                                                    <div className="mt-3">
                                                        <button
                                                            className="btn btn-primary me-2"
                                                            onClick={() => loadGlobalTemplate(selectedGlobalTemplate)}
                                                            disabled={!selectedBMR}
                                                        >
                                                            <i className="fa-solid fa-download me-2"></i>
                                                            Load into Current BMR
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setSelectedGlobalTemplate(null)}
                                                        >
                                                            Back to List
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <h5>Available Global Templates</h5>
                                {globalTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No global templates found. Create your first template above.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Template Name</th>
                                                    <th>Category</th>
                                                    <th>Description</th>
                                                    <th>Items</th>
                                                    <th>Department</th>
                                                    <th>Created</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {globalTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <strong>{template.name}</strong>
                                                            {template.is_public && (
                                                                <span className="badge bg-success ms-2">Public</span>
                                                            )}
                                                        </td>
                                                        <td>{template.category}</td>
                                                        <td>{template.description}</td>
                                                        <td>
                                                            <span className="badge bg-info">
                                                                {template.template_data?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>{template.department || 'All'}</td>
                                                        <td>
                                                            {new Date(template.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td>
                                                            <div className="btn-group btn-group-sm">
                                                                <button
                                                                    className="btn btn-outline-primary me-1"
                                                                    onClick={() => setSelectedGlobalTemplate(template)}
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success me-1"
                                                                    onClick={() => loadGlobalTemplate(template)}
                                                                    disabled={!selectedBMR}
                                                                >
                                                                    <i className="fa-solid fa-download"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => deleteGlobalTemplate(template.id)}
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

            {/* Process Template Modal */}
            {showProcessTemplateModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Process Templates - {activeProductionDepartment}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowProcessTemplateModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="card mb-3">
                                    <div className="card-header">
                                        <h6>Add New Process Template</h6>
                                    </div>
                                    <div className="card-body">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="form-floating mb-3">
                                                    <input
                                                        type="text"
                                                        className="form-control"
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
                                                        className="form-control"
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

                                <h5>Existing Templates</h5>
                                {processTemplates.length === 0 ? (
                                    <div className="alert alert-info text-center">
                                        No process templates found. Add your first template above.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Handler Name</th>
                                                    <th>Amount (₹/min)</th>
                                                    <th>Created</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {processTemplates.map((template, index) => (
                                                    <tr key={template.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <strong>{template.handler_name}</strong>
                                                        </td>
                                                        <td>₹{template.amount}</td>
                                                        <td>
                                                            {new Date(template.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="btn btn-sm btn-outline-danger"
                                                                onClick={() => deleteProcessTemplate(template.id)}
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
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    Saved Template - {selectedSavedTemplate.name}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={() => setSelectedSavedTemplate(null)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-12">
                                        <div className="card mb-3">
                                            <div className="card-body">
                                                <h6>Template Information</h6>
                                                <p><strong>Product:</strong> {selectedSavedTemplate.productName}</p>
                                                <p><strong>Assembly:</strong> {selectedSavedTemplate.assemblyName}</p>
                                                <p><strong>Saved:</strong> {new Date(selectedSavedTemplate.savedAt).toLocaleString()}</p>
                                                <p><strong>Items:</strong> {selectedSavedTemplate.templateData?.length || 0}</p>
                                            </div>
                                        </div>
                                        
                                        <h5>Template Data</h5>
                                        {selectedSavedTemplate.templateData?.length > 0 ? (
                                            <div className="table-responsive">
                                                <table className="table table-sm table-bordered">
                                                    <thead>
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Raw Material</th>
                                                            <th>Part No</th>
                                                            <th>Internal S/N</th>
                                                            <th>Description</th>
                                                            <th>Qty</th>
                                                            <th>Price</th>
                                                            <th>Issued By</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedSavedTemplate.templateData?.map((item, index) => (
                                                            <tr key={index}>
                                                                <td>{index + 1}</td>
                                                                <td>{item.rawMaterial || 'N/A'}</td>
                                                                <td>{item.partNo || 'N/A'}</td>
                                                                <td>
                                                                    <span className={`badge ${item.internalSerialNo ? 'bg-success' : 'bg-warning'}`}>
                                                                        {item.internalSerialNo || 'No Barcode'}
                                                                    </span>
                                                                </td>
                                                                <td>{item.description || 'N/A'}</td>
                                                                <td>{item.quantity || 1}</td>
                                                                <td>₹{item.price || 0}</td>
                                                                <td>
                                                                    <span className={`badge ${item.issuedBy ? 'bg-primary' : 'bg-secondary'}`}>
                                                                        {item.issuedBy || 'Not Issued'}
                                                                    </span>
                                                                </td>
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
                                        deleteSavedTemplate(selectedSavedTemplate.id);
                                        setSelectedSavedTemplate(null);
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
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    BMR History - {activeProductionDepartment}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
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
                                                        className="form-select"
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
                                                        className="form-control"
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
                                        No BMR history found matching your criteria.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>BMR Name</th>
                                                    <th>Initial Code</th>
                                                    <th>Product</th>
                                                    <th>Assembly</th>
                                                    <th>Items</th>
                                                    <th>Processes</th>
                                                    <th>Completed Date</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getFilteredHistory().map((history, index) => (
                                                    <tr key={history.id}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <strong>{history.bmr_name}</strong>
                                                        </td>
                                                        <td>
                                                            <span className="badge bg-primary">{history.initial_code}</span>
                                                        </td>
                                                        <td>{history.product_name}</td>
                                                        <td>{history.assembly_name}</td>
                                                        <td>
                                                            <span className="badge bg-info">
                                                                {history.template_data?.length || 0}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="badge bg-warning">
                                                                {history.processes_data?.length || 0}
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
                                                                >
                                                                    <i className="fa-solid fa-eye me-1"></i>
                                                                    View
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-success"
                                                                    onClick={() => printHistoryItem(history)}
                                                                >
                                                                    <i className="fa-solid fa-print me-1"></i>
                                                                    Print
                                                                </button>
                                                                <button
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => deleteHistoryItem(history.id)}
                                                                >
                                                                    <i className="fa-solid fa-trash me-1"></i>
                                                                    Delete
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
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    History Details - {selectedHistoryItem.bmr_name}
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
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
                                        <table className="table table-striped table-bordered">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Raw Material</th>
                                                    <th>Part No</th>
                                                    <th>Internal S/N</th>
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
                                                    const total = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
                                                    return (
                                                        <tr key={index}>
                                                            <td>{index + 1}</td>
                                                            <td>{item.rawMaterial || ''}</td>
                                                            <td>{item.partNo || ''}</td>
                                                            <td>{item.internalSerialNo || ''}</td>
                                                            <td>{item.description || ''}</td>
                                                            <td>{item.quantity || 1}</td>
                                                            <td>₹{parseFloat(item.price || 0).toFixed(2)}</td>
                                                            <td>₹{total.toFixed(2)}</td>
                                                            <td>{item.issuedBy || ''}</td>
                                                            <td>{item.receivedBy || ''}</td>
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
                                            <table className="table table-striped table-bordered">
                                                <thead>
                                                    <tr>
                                                        <th>Process Name</th>
                                                        <th>Handler(s)</th>
                                                        <th>Status</th>
                                                        <th>Total Time</th>
                                                        <th>Total Cost (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedHistoryItem.processes_data.map((process, index) => {
                                                        const handlers = process.handlers || [];
                                                        const hasMultipleHandlers = handlers.length > 0;
                                                        
                                                        let totalProcessTime = 0;
                                                        let totalProcessCost = 0;
                                                        
                                                        if (hasMultipleHandlers) {
                                                            handlers.forEach(handler => {
                                                                totalProcessTime += handler.elapsedTime || 0;
                                                                totalProcessCost += (handler.amount || 0) * ((handler.elapsedTime || 0) / 60000);
                                                            });
                                                        } else {
                                                            totalProcessTime = process.elapsedTime || 0;
                                                            totalProcessCost = (process.amount || 0) * ((process.elapsedTime || 0) / 60000);
                                                        }
                                                        
                                                        return (
                                                            <tr key={index}>
                                                                <td><strong>{process.name}</strong></td>
                                                                <td>
                                                                    {hasMultipleHandlers ? 
                                                                        handlers.map((handler, idx) => `
                                                                            <div class="handler-row">
                                                                                <strong>${handler.name}</strong> 
                                                                                (₹${handler.amount}/min)<br/>
                                                                                Time: ${formatTime(handler.elapsedTime || 0)} | 
                                                                                Cost: ₹${((handler.amount || 0) * ((handler.elapsedTime || 0) / 60000)).toFixed(2)} |
                                                                                Status: ${handler.status || 'initiate'}
                                                                            </div>
                                                                        `).join('') :
                                                                        (process.handler || 'N/A')
                                                                    }
                                                                </td>
                                                                <td>{process.status}</td>
                                                                <td>{formatTime(totalProcessTime)}</td>
                                                                <td>₹{totalProcessCost.toFixed(2)}</td>
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

            {/* Completion Modal */}
            {showCompletionModal && (
                <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Complete BMR - {completedBMR?.name}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowCompletionModal(false)}></button>
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
                                                        return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
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
                                                            return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
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
                                                className="form-control"
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
                                                className="form-control"
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
                                                className="form-control"
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
                                                className="form-control"
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
                                                className="form-control"
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
                                                type="number"
                                                className="form-control"
                                                placeholder="Quantity"
                                                value={newCompletedProduct.Quantity}
                                                onChange={(e) => setNewCompletedProduct(prev => ({ ...prev, Quantity: parseInt(e.target.value) || 1 }))}
                                                min="1"
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
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="editProductModalLabel">Edit Product</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control"
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
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="editAssemblyModalLabel">Edit Assembly</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control"
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
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id="editBMRModalLabel">Edit BMR</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="BMR Name"
                                    value={newBMR.name}
                                    onChange={(e) => setNewBMR(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <label>BMR Name</label>
                            </div>
                            <div className="form-floating mb-3">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Initial Code"
                                    value={newBMR.initialCode}
                                    onChange={(e) => setNewBMR(prev => ({ ...prev, initialCode: e.target.value }))}
                                />
                                <label>Initial Code</label>
                            </div>
                            <div className="form-floating mb-3">
                                <select
                                    className="form-select"
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
                                    className="form-select"
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

