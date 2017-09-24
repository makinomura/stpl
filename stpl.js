/**
 * Created by Maki on 2017/09/22.
 */

//默认隐藏待渲染的元素
document.write('<style>\n' +
    '        [m-render] {\n' +
    '            display: none;\n' +
    '        }\n' +
    '</style>');

(function ($) {

    /**
     * @author Maki
     * 渲染html模板
     * 使用{{expression}}包含的表达式将被计算
     * m-if 接收false时元素将被隐藏
     * m-on-event name 绑定事件
     * m-for 循环输出元素
     * m-ready 当前元素(包括所有子元素)渲染完毕后触发
     * @param obj 数据
     * @param callback 渲染完成时回调
     * @returns {jQuery|HTMLElement}
     */
    $.fn.render = function (obj, callback) {
        var $this = $(this);

        var M_RENDER = 'm-render';
        var M_IF = 'm-if';
        var M_FOR = 'm-for';
        var M_ON = 'm-on-';
        var M_READY = 'm-ready';

        //主表达式执行环境
        var funcBody = [];
        $.each(obj, function (i, n) {
            if (obj.hasOwnProperty(i)) {
                funcBody.push('var ');
                funcBody.push(i);
                funcBody.push(' = this.');
                funcBody.push(i);
                funcBody.push(';')
            }
        });
        funcBody.push('return eval(expression);');
        var environment = new Function('expression', funcBody.join(''));

        /**
         * 执行表达式获取结果
         * @param expression 表达式
         * @returns {*}
         */
        var eval_expression = function (expression) {
            return environment.call(obj, expression);
        };

        /**
         * 执行html中所有表达式
         * @param html
         * @param caller 执行表达式的方法
         * @returns {*}
         */
        var do_expression = function (html, caller) {
            var reg = /{{[^{]+}}/g;
            var compute;
            while ((compute = reg.exec(html)) !== null) {
                var match = compute[0];
                var result = match.replace(/{{([^{]+)}}/g, '$1');
                try {
                    html = html.replace(match, caller(result));
                } catch (e) {
                    console.error(e);
                    html = html.replace(match, '');
                }
            }
            return html;
        };

        /**
         * 元素显示或隐藏
         * @param $element
         */
        var do_if = function ($element, caller) {

            var flag = $element.attr(M_IF);

            if (flag) {
                if (flag === 'false') {
                    $element.remove();
                    return false;
                } else {
                    var result = caller(flag);
                    if (result instanceof Function) {
                        result = result.call($element[0]);
                    }

                    if (result === false || result === 'false') {
                        $element.remove();
                        return false;
                    }
                }
            }
            $element.removeAttr(M_IF);
            return true;
        };

        /**
         * 处理属性，文本
         * @param $element
         * @param caller
         */
        var do_attrs_text = function ($element, caller) {
            $.each($element[0].attributes, function (index, attrNode) {
                var value = $.trim(attrNode.value);
                if (value && value !== '') {
                    attrNode.value = do_expression(value, caller);
                }
            });

            $.each($element[0].childNodes, function (k, node) {
                if (node.nodeType === 3) {
                    var text = $.trim(node.nodeValue);
                    if (text && text !== '') {
                        node.nodeValue = (do_expression(text, caller));
                    }
                }
            })

        };

        /**
         * 处理事件绑定
         * @param $element
         * @param caller
         */
        var do_events = function ($element, caller) {

            $.each($element[0].attributes, function (index, attrNode) {
                var value = $.trim(attrNode.value);
                var attrName = $.trim(attrNode.nodeName);

                if (new RegExp('^' + M_ON + '\\S+').test(attrName)) {
                    var eventName = attrName.replace(new RegExp('^' + M_ON + '(\\S+)'), '$1');

                    var flag = $element.attr(attrName);
                    if (flag) {
                        $element.on(eventName, function () {
                            var result = caller(flag);
                            if (result instanceof Function) {
                                result.apply(this, arguments);
                            }
                        });
                        $element.removeAttr(attrName);
                    }
                }

            });
        };

        /**
         * 处理m-for
         * @param $element
         * @param caller
         */
        var do_for = function ($element, caller) {

            var m_for = $.trim($element.attr(M_FOR));
            if (m_for === '') {
                return false;
            }

            var names = m_for.replace(/(\S+)\s*,\s*(\S+)\s*\s+in\s+(.+)/, '$1,$2,$3');
            if (names === m_for) {
                throw new Error('Unrecognized value format "' + m_for + '" m-for tag should like m-for="index,item in source"');
            }

            names = names.split(',');
            var indexName = names[0];
            var itemName = names[1];
            var sourceName = names[2];

            var template = $element.html();
            $element.empty();

            var source = caller(sourceName);

            var do_for_fun = function (item, index, expression) {
                return caller('(' + 'function (obj){' +
                    'var ' + indexName + ' = ' + 'obj.index;' +
                    'var ' + itemName + ' = ' + sourceName + '[obj.index];' +
                    'return eval(obj.exp);' +
                    '}' + ').call(' + sourceName + '[' + index + '],' + '{index: ' + index + ',exp: \"' + expression.split('"').join('\\"') + '\"})');
            };

            if (source instanceof Array) {
                $.each(source, function (i, n) {
                    var $template = $(template);

                    var iicaller = function (exp) {
                        return do_for_fun.call(null, n, i, exp);
                    };
                    $template.appendTo($element);
                    action($template, iicaller);
                });
                $element.removeAttr(M_FOR);
            } else {
                throw new Error(sourceName + ' is not a array-like object!');
            }

            return true;
        };

        /**
         * 元素渲染完毕
         * @param $element
         * @param caller 
         */
        var do_ready = function ($element, caller) {
            var expression = $element.attr(M_READY);
            if (expression) {
                var result = caller.call(null, expression);
                if (result instanceof Function) {
                    result.call($element[0]);
                }
                $element.removeAttr(M_READY);
            }
        }

        /**
         * 主渲染方法
         * @param $element
         * @param caller
         */
        var action = function ($element, caller) {
            do_attrs_text($element, caller);

            if (do_if($element, caller)) {
                if (!do_for($element, caller)) {
                    $element.children().each(function () {
                        action($(this), caller);
                    })
                }
                do_events($element, caller);
            }

            do_ready($element, caller);
        };
        //保存模板
        var renderTemplate = $this.data('render-template');
        if (!renderTemplate) {
            $this.data('render-template', $this.html());
        } else {
            $this.html(renderTemplate);
        }
        //开始渲染
        action($this, eval_expression);

        if (callback) {
            callback.call(this, obj);
        }
        $this.fadeIn();
        $this.removeAttr('m-render');

        return $this;
    };
})(window.jQuery)

