#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/*  */

uniform sampler2D solid_main;
uniform sampler2D solid_depth;
uniform sampler2D translucent_depth;
uniform sampler2D translucent_main;
uniform sampler2D entity_main;
uniform sampler2D entity_depth;
uniform sampler2D particles_main;
uniform sampler2D particles_depth;
uniform sampler2D weather_main;
uniform sampler2D weather_depth;
uniform sampler2D clouds_main;
uniform sampler2D clouds_depth;

varying vec2 _cvv_texcoord;

#define NUM_LAYERS 6

vec4 color_layers[NUM_LAYERS];
float depth_layers[NUM_LAYERS];
int active_layers = 0;

void try_insert(vec4 color, float depth) {
	if (color.a == 0.0) {
		return;
	}

	color_layers[active_layers] = color;
	depth_layers[active_layers] = depth;

	int target = active_layers++;
	int probe = target - 1;

	while (target > 0 && depth_layers[target] > depth_layers[probe]) {
		float probeDepth = depth_layers[probe];
		depth_layers[probe] = depth_layers[target];
		depth_layers[target] = probeDepth;

		vec4 probeColor = color_layers[probe];
		color_layers[probe] = color_layers[target];
		color_layers[target] = probeColor;

		target = probe--;
	}
}

vec3 blend(vec3 dst, vec4 src) {
	return (dst * (1.0 - src.a)) + src.rgb;
}

void main() {
	color_layers[0] = vec4(texture2D(solid_main, _cvv_texcoord).rgb, 1.0);
	depth_layers[0] = texture2D(solid_depth, _cvv_texcoord).r;
	active_layers = 1;

	try_insert(texture2D(translucent_main, _cvv_texcoord), texture2D(translucent_depth, _cvv_texcoord).r);
	try_insert(texture2D(entity_main, _cvv_texcoord), texture2D(entity_depth, _cvv_texcoord).r);
	try_insert(texture2D(particles_main, _cvv_texcoord), texture2D(particles_depth, _cvv_texcoord).r);
	try_insert(texture2D(weather_main, _cvv_texcoord), texture2D(weather_depth, _cvv_texcoord).r);
	try_insert(texture2D(clouds_main, _cvv_texcoord), texture2D(clouds_depth, _cvv_texcoord).r);

	vec3 texelAccum = color_layers[0].rgb;

	for (int i = 1; i < active_layers; ++i) {
		texelAccum = blend(texelAccum, color_layers[i]);
	}

	gl_FragData[1] = vec4(depth_layers[active_layers - 1], 0, 0, 1);
	gl_FragData[0] = vec4(texelAccum.rgb, 1.0);
	//depth_layers[active_layers - 1];
	//gl_FragDepth = texture2D(solid_depth, _cvv_texcoord).r;
	//gl_FragDepth = texture2D(solid_depth, _cvv_texcoord).r;
}


